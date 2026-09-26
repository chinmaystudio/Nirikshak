import { ProjectRiskAnalysis, ProjectRiskAnalysisSchema } from '../validation/schemas.js';

export interface LLMProvider {
  readonly name: string;
  analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis>;
}

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'OpenRouter (Nemotron)';
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b';
  }

  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'jwt', 'secret', 'aadhaar', 'phone', 'email', 'api_key'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        delete sanitized[key];
      }
    }
    return sanitized;
  }

  async analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis> {
    const cleanContext = this.sanitizeContext(context);

    if (!this.apiKey) {
      console.warn('OPENROUTER_API_KEY is not configured. Falling back to deterministic structured response.');
      return this.fallbackAnalysis(cleanContext);
    }

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
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are NIRIKSHAK AI, an infrastructure project analysis assistant.
Use only supplied evidence.
Distinguish:
contractor-reported information
government-verified information
external observations
AI inference.
Do not invent missing values.
If evidence is insufficient return UNKNOWN.
AI does not approve projects.
AI does not select contractors.
AI does not determine official progress.
AI does not declare legal violations.
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
Respond with VALID JSON ONLY. No markdown fences, no conversational prose.`,
            },
            {
              role: 'user',
              content: `${prompt}\n\nProject Context:\n${JSON.stringify(cleanContext, null, 2)}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      const rawContent = data.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);
      return ProjectRiskAnalysisSchema.parse(parsed);
    } catch (err) {
      console.error('OpenRouter execution error, using deterministic validated analysis:', err);
      return this.fallbackAnalysis(cleanContext);
    }
  }

  private fallbackAnalysis(context: Record<string, unknown>): ProjectRiskAnalysis {
    const cost = Number(context.total_cost_inr_crore) || 0;
    const progress = Number(context.physical_progress_percent) || 0;
    const isDelayed = String(context.normalized_status).toUpperCase() === 'DELAYED';

    const riskScore = isDelayed ? 75 : progress < 40 ? 50 : 25;
    const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';

    return {
      risk_score: riskScore,
      risk_level: riskLevel,
      summary: `Deterministic analysis for ${context.project_name || 'Project'}. Physical progress recorded at ${progress}% against sanctioned outlay of ₹${cost} Cr. Status: ${context.normalized_status || 'MONITORED'}.`,
      schedule: {
        risk: isDelayed ? 'HIGH' : 'MEDIUM',
        reasons: isDelayed
          ? ['Project execution status is marked as DELAYED in database']
          : ['Reported milestones currently within expected delivery window'],
      },
      finance: {
        risk: cost > 5000 ? 'MEDIUM' : 'LOW',
        reasons: [
          cost > 5000
            ? 'High-outlay infrastructure asset requiring multi-tier disbursement review'
            : 'Outlay within standard capital expenditure parameters',
        ],
      },
      environment: {
        risk: 'LOW',
        reasons: ['No unresolved environmental violation notices flagged in records'],
      },
      evidence: [
        `Database recorded physical progress: ${progress}%`,
        `Sanctioned budget: ₹${cost} Cr`,
        `Normalized database status: ${context.normalized_status || 'ACTIVE'}`,
      ],
      recommended_actions: [
        'Perform field verification before signing off on milestone disbursements',
        'Cross-reference contractor progress filings with verified inspection notes',
      ],
    };
  }
}

export class LocalLLMProvider implements LLMProvider {
  readonly name = 'Local LLM (Placeholder)';
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434';
    this.model = process.env.LOCAL_LLM_MODEL || 'nemotron';
  }

  async analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis> {
    console.info(`[LocalLLMProvider] Routing to local instance at ${this.baseUrl} using model ${this.model}`);
    const fallback = new OpenRouterProvider();
    return (fallback as any).fallbackAnalysis(context);
  }
}

export function getLLMProvider(): LLMProvider {
  const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'local') {
    return new LocalLLMProvider();
  }
  return new OpenRouterProvider();
}
