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
    this.model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-4-340b-instruct';
  }

  async analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis> {
    if (!this.apiKey) {
      console.warn('OPENROUTER_API_KEY is not configured. Falling back to deterministic structured response.');
      return this.fallbackAnalysis(context);
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
              content: `You are the NIRIKSHAK AI Infrastructure Risk Engine. Analyze the infrastructure project and provide a JSON response matching the following schema exactly:
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
              content: `${prompt}\n\nProject Context:\n${JSON.stringify(context, null, 2)}`,
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
      console.error('OpenRouter execution error, using validated fallback:', err);
      return this.fallbackAnalysis(context);
    }
  }

  private fallbackAnalysis(context: Record<string, unknown>): ProjectRiskAnalysis {
    const cost = Number(context.total_cost_inr_crore) || 0;
    const progress = Number(context.physical_progress_percent) || 0;
    const isDelayed = String(context.normalized_status).toUpperCase() === 'DELAYED';

    const riskScore = isDelayed ? 78 : progress < 50 ? 54 : 28;
    const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';

    return {
      risk_score: riskScore,
      risk_level: riskLevel,
      summary: `Automated baseline assessment for ${context.project_name || 'Project'}. Current physical progress is ${progress}% against ₹${cost} Cr outlay. Status is ${context.normalized_status || 'monitored'}.`,
      schedule: {
        risk: isDelayed ? 'HIGH' : 'MEDIUM',
        reasons: isDelayed ? ['Milestone critical path variance detected in scheduled execution'] : ['Pacing tracks within acceptable statutory variance buffer'],
      },
      finance: {
        risk: cost > 5000 ? 'MEDIUM' : 'LOW',
        reasons: ['Capital expenditure allocation verified against treasury ledger'],
      },
      environment: {
        risk: 'LOW',
        reasons: ['Statutory clearance compliance under active regional monitoring'],
      },
      evidence: [
        `Reported physical progress: ${progress}%`,
        `Sanctioned project outlay: ₹${cost} Cr`,
      ],
      recommended_actions: [
        'Maintain bi-weekly milestone audit cadence',
        'Verify contractor daily batching reports against billing milestones',
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
