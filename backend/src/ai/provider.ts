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
 * Model configuration.
 *
 * OPENROUTER_MODELS / OPENROUTER_VISION_MODELS: comma-separated model ids,
 * tried in order (OPENROUTER_MODEL is still honoured as the first entry).
 *
 * Government data must not go to endpoints that log or train on prompts, so:
 *  - every request asks OpenRouter to route only to providers with a
 *    zero-data-retention policy that do not collect data (AI_REQUIRE_ZDR,
 *    default true). If no such endpoint serves a model, that model fails and
 *    the next one is tried; if none qualify the API returns an error instead
 *    of sending the data anywhere else.
 *  - ":free" model ids are refused unless AI_ALLOW_FREE_MODELS=true (free
 *    endpoints are the ones most likely to retain prompts).
 */
function parseModelList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

export function allowFreeModels(): boolean {
  return process.env.AI_ALLOW_FREE_MODELS === 'true';
}

export function requireZeroDataRetention(): boolean {
  return process.env.AI_REQUIRE_ZDR !== 'false';
}

export function filterAllowedModels(models: string[]): string[] {
  const unique = models.filter((v, i, a) => a.indexOf(v) === i);
  return allowFreeModels() ? unique : unique.filter((m) => !m.endsWith(':free'));
}

export const DEFAULT_TEXT_MODELS = ['nvidia/nemotron-3-super-120b-a12b'];
export const DEFAULT_VISION_MODELS = ['nvidia/nemotron-3.5-super-vl'];

export function textModelCandidates(): string[] {
  const configured = [
    ...parseModelList(process.env.OPENROUTER_MODEL),
    ...parseModelList(process.env.OPENROUTER_MODELS),
  ];
  return filterAllowedModels(configured.length > 0 ? configured : DEFAULT_TEXT_MODELS);
}

export function visionModelCandidates(): string[] {
  const configured = parseModelList(process.env.OPENROUTER_VISION_MODELS);
  return filterAllowedModels(configured.length > 0 ? configured : DEFAULT_VISION_MODELS);
}

/** Back-compat export used by routes/tests. */
export const AI_MODEL_CANDIDATES: string[] = textModelCandidates();

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 25_000;

/**
 * One chat-completions call with timeout and privacy routing. Throws an error
 * carrying `modelLevel: true` for failures where retrying the same model is
 * pointless (auth, credit, unknown model, rate limit, no compliant provider).
 */
export async function openRouterChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: unknown }>
): Promise<{ content: string; totalTokens: number | null }> {
  const body: Record<string, unknown> = {
    model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.2,
  };
  if (requireZeroDataRetention()) {
    body.provider = { data_collection: 'deny', zdr: true };
  }

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://nirikshak.pages.dev',
        'X-Title': 'NIRIKSHAK Infrastructure Audit',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw Object.assign(new Error(timedOut ? `OpenRouter timed out after ${AI_TIMEOUT_MS}ms` : `OpenRouter unreachable: ${err?.message}`), {
      modelLevel: timedOut,
    });
  }

  if (!response.ok) {
    const modelLevel = [400, 401, 402, 403, 404, 429].includes(response.status);
    throw Object.assign(new Error(`OpenRouter HTTP ${response.status}: ${response.statusText}`), { modelLevel });
  }
  const data: any = await response.json();
  return {
    content: data?.choices?.[0]?.message?.content || '{}',
    totalTokens: data?.usage?.total_tokens ?? null,
  };
}

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

    const candidates = textModelCandidates();
    if (candidates.length === 0) {
      throw new Error('AI_ANALYSIS_UNAVAILABLE: no permitted AI model is configured (set OPENROUTER_MODELS)');
    }

    for (const model of candidates) {
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { content: rawContent, totalTokens } = await openRouterChat(this.apiKey, model, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ]);
          const parsed = JSON.parse(rawContent);
          const validated = ProjectRiskAnalysisSchema.parse(parsed);

          const latency = Date.now() - startTime;
          this.lastRun = {
            model,
            latencyMs: latency,
            totalTokens,
            promptHash,
            status: 'SUCCESS',
          };
          // Rule 64: Log only metadata, never raw sensitive prompts
          console.info(`[AI_LOG] provider=OpenRouter model=${model} latency=${latency}ms tokens=${totalTokens ?? 0} status=SUCCESS promptHash=${promptHash}`);

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
      model: candidates[candidates.length - 1],
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
export const AI_VISION_MODEL_CANDIDATES: string[] = visionModelCandidates();

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

  const permitted = filterAllowedModels(models);
  if (permitted.length === 0) {
    throw new Error('AI_ANALYSIS_UNAVAILABLE: no permitted AI model is configured');
  }
  for (const model of permitted) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { content: raw, totalTokens } = await openRouterChat(apiKey, model, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ]);
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const json = JSON.parse(cleaned);
        return {
          json,
          model,
          latencyMs: Date.now() - startTime,
          totalTokens,
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
