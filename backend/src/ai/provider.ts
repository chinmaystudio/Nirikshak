import crypto from 'crypto';
import { ProjectRiskAnalysis, ProjectRiskAnalysisSchema } from '../validation/schemas.js';

export interface LLMProvider {
  readonly name: string;
  analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis>;
}

/**
 * Recursive context sanitizer (Rules 59, 60).
 * Strips secrets, tokens, PII (email, phone, aadhaar), competitor bids, and internal notes.
 */
export function sanitizeContext(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact JWTs
    let scrubbed = data.replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[REDACTED_TOKEN]');
    // Redact Emails
    scrubbed = scrubbed.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]');
    // Redact 12-digit Aadhaar / 10-digit Phone numbers
    scrubbed = scrubbed.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_AADHAAR]');
    scrubbed = scrubbed.replace(/\b[6-9]\d{9}\b/g, '[REDACTED_PHONE]');
    return scrubbed;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeContext(item));
  }

  if (typeof data === 'object') {
    const prohibitedKeys = [
      'password',
      'token',
      'jwt',
      'secret',
      'service_role',
      'api_key',
      'aadhaar',
      'phone',
      'mobile',
      'email',
      'address',
      'bid_amount',
      'technical_proposal',
      'internal_notes',
      'reviewer_notes',
      'complainant_phone',
      'complainant_email',
      'citizen_phone',
      'citizen_email',
    ];

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (prohibitedKeys.some((p) => lowerKey.includes(p))) {
        continue; // Omit prohibited property entirely
      }
      cleanObj[key] = sanitizeContext(value);
    }
    return cleanObj;
  }

  return data;
}

/**
 * Candidate models, tried in order. The configured model (OPENROUTER_MODEL)
 * goes first; the rest are fallbacks so a single retired/renamed model id
 * can never take the whole AI pipeline down again — that is exactly what
 * happened with 'nvidia/nemotron-3-super-120b-a12b:free', which OpenRouter
 * retired (every analysis returned HTTP 404 while the key was valid).
 * Verified against GET https://openrouter.ai/api/v1/models on 2026-11-18.
 */
export const AI_MODEL_CANDIDATES: string[] = [
  ...(process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL] : []),
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3.5-lightning:free',
].filter((v, i, a) => a.indexOf(v) === i);

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'OpenRouter (Nemotron)';
  private apiKey: string;
  /** Metadata of the most recent run, for the ai_runs audit row. */
  public lastRun: {
    model: string;
    latencyMs: number;
    totalTokens: number | null;
    promptHash: string;
    status: 'SUCCESS' | 'FAILED';
  } | null = null;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  async analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis> {
    const cleanContext = sanitizeContext(context);

    // Rule 62: Never return fabricated insight when API key or provider is unavailable
    if (!this.apiKey) {
      throw new Error('AI_ANALYSIS_UNAVAILABLE: OPENROUTER_API_KEY is not configured on this server');
    }

    const systemPrompt = `You are NIRIKSHAK AI, an infrastructure project analysis assistant.
Use only supplied evidence.
Distinguish:
- contractor-reported information
- government-verified information
- external observations
- AI inference.
Do not invent missing values.
If evidence is insufficient return UNKNOWN.
AI does not approve projects.
AI does not select contractors.
AI does not determine official progress.
AI does not declare legal violations.
Calibrate risk_score with these bands and set risk_level to the band containing the score: 0-24 LOW, 25-49 MEDIUM, 50-74 HIGH, 75-100 CRITICAL.
The summary must open with concrete findings supported by numbers in the context (progress vs schedule, budget, milestones, complaints), not with a statement about missing data.
Return structured JSON only matching the schema:
{
  "risk_score": number (0-100),
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": string,
  "schedule": { "risk": string, "reasons": string[] },
  "finance": { "risk": string, "reasons": string[] },
  "environment": { "risk": string, "reasons": string[] },
  "evidence": string[],
  "recommended_actions": string[]
}
Respond with VALID JSON ONLY. No markdown fences, no conversational prose.`;

    const userPrompt = `${prompt}\n\nProject Context:\n${JSON.stringify(cleanContext, null, 2)}`;
    const promptHash = crypto.createHash('sha256').update(userPrompt).digest('hex').slice(0, 16);
    const startTime = Date.now();

    // Rule 63: Validate structured response using Zod. On invalid output
    // retry once per model, then move to the next candidate model; FAILED
    // only when every candidate is exhausted. Model-level failures
    // (404 retired id, 402 no credit, 429 rate limit) skip straight to the
    // next candidate instead of burning retries.
    let lastError: Error | null = null;

    for (const model of AI_MODEL_CANDIDATES) {
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://nirikshak.gov.in',
              'X-Title': 'NIRIKSHAK Infrastructure Audit',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
            }),
          });

          if (!response.ok) {
            const modelLevel = [401, 402, 404, 429].includes(response.status);
            throw Object.assign(
              new Error(`OpenRouter HTTP ${response.status}: ${response.statusText}`),
              { modelLevel }
            );
          }

          const data = await response.json();
          const rawContent = data.choices[0]?.message?.content || '{}';
          const parsed = JSON.parse(rawContent);
          const validated = ProjectRiskAnalysisSchema.parse(parsed);

          const latency = Date.now() - startTime;
          this.lastRun = {
            model,
            latencyMs: latency,
            totalTokens: data.usage?.total_tokens ?? null,
            promptHash,
            status: 'SUCCESS',
          };
          // Rule 64: Log only metadata, never raw sensitive prompts
          console.info(`[AI_LOG] provider=OpenRouter model=${model} latency=${latency}ms tokens=${data.usage?.total_tokens ?? 0} status=SUCCESS promptHash=${promptHash}`);

          return validated;
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI_LOG] model=${model} attempt ${attempt} failed: ${err.message}. promptHash=${promptHash}`);
          if (err?.modelLevel) break; // next candidate model
        }
      }
    }

    const latency = Date.now() - startTime;
    this.lastRun = {
      model: AI_MODEL_CANDIDATES[AI_MODEL_CANDIDATES.length - 1],
      latencyMs: latency,
      totalTokens: null,
      promptHash,
      status: 'FAILED',
    };
    console.error(`[AI_LOG] provider=OpenRouter latency=${latency}ms status=FAILED promptHash=${promptHash} error=${lastError?.message}`);
    throw new Error(`AI_ANALYSIS_FAILED: All candidate models failed. Last error: ${lastError?.message}`);
  }
}

export function getLLMProvider(): LLMProvider {
  return new OpenRouterProvider();
}

/** Vision-capable candidates for the citizen infrastructure scanner. */
export const AI_VISION_MODEL_CANDIDATES: string[] = [
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

export interface ChatJsonResult {
  json: any;
  model: string;
  latencyMs: number;
  totalTokens: number | null;
}

/**
 * Generic chat-completions JSON call with the same discipline as the risk
 * provider: no fabrication — throws AI_ANALYSIS_UNAVAILABLE without a key,
 * walks the candidate list on model-level failures, parses JSON strictly.
 * `userContent` may be a string or OpenRouter content parts (text + image).
 */
export async function chatJson(
  systemPrompt: string,
  userContent: string | Array<Record<string, unknown>>,
  models: string[]
): Promise<ChatJsonResult> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    throw new Error('AI_ANALYSIS_UNAVAILABLE: OPENROUTER_API_KEY is not configured on this server');
  }
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://nirikshak.gov.in',
            'X-Title': 'NIRIKSHAK Infrastructure Audit',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
        });
        if (!response.ok) {
          const modelLevel = [401, 402, 404, 429].includes(response.status);
          throw Object.assign(
            new Error(`OpenRouter HTTP ${response.status}: ${response.statusText}`),
            { modelLevel }
          );
        }
        const data = await response.json();
        const raw = data.choices[0]?.message?.content || '{}';
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const json = JSON.parse(cleaned);
        return {
          json,
          model,
          latencyMs: Date.now() - startTime,
          totalTokens: data.usage?.total_tokens ?? null,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI_LOG] chatJson model=${model} attempt ${attempt} failed: ${err.message}`);
        if (err?.modelLevel) break;
      }
    }
  }
  throw new Error(`AI_ANALYSIS_FAILED: All candidate models failed. Last error: ${lastError?.message}`);
}
