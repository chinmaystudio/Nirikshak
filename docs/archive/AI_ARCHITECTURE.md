# NIRIKSHAK AI Architecture & Risk Engine

## 1. Design Principles
1. **Provider Abstraction**: Decoupled from specific vendors via the `LLMProvider` interface.
2. **Security & Zero Credentials**: The AI is never given database credentials, service role keys, or unrestricted query access.
3. **Structured JSON Output Only**: No arbitrary markdown or hallucinations; responses are strictly validated via Zod (`ProjectRiskAnalysisSchema`).
4. **Advisory Role**: The AI advises; designated government officers decide.

---

## 2. Provider Abstraction
```typescript
export interface LLMProvider {
  name: string;
  analyzeProject(prompt: string, context: Record<string, unknown>): Promise<ProjectRiskAnalysis>;
}
```

Implementations:
- `OpenRouterProvider`: Production provider calling OpenRouter's `nvidia/nemotron-4-340b-instruct` model.
- `LocalLLMProvider`: Local Ollama / vLLM placeholder instance for air-gapped government environments.

---

## 3. Schema & Structured Response
The risk engine returns a typed object:
```json
{
  "risk_score": 78,
  "risk_level": "HIGH",
  "summary": "Pune Ring Road package 2 shows 45 days variance in utility shifting.",
  "schedule": {
    "risk": "HIGH",
    "reasons": ["Utility shifting clearance pending from MSEDCL"]
  },
  "finance": {
    "risk": "MEDIUM",
    "reasons": ["Disbursement pace tracks at 64% against 75% target"]
  },
  "environment": {
    "risk": "LOW",
    "reasons": ["Air particulate levels (PM2.5) within CPCB construction limits"]
  },
  "evidence": [
    "Reported physical progress: 41.5%",
    "Sanctioned project outlay: ₹2,450 Cr"
  ],
  "recommended_actions": [
    "Expedite inter-departmental utility coordination meeting",
    "Request updated CPM/PERT chart from concessionaire"
  ]
}
```
All outputs are saved to `public.ai_insights` and linked to `public.ai_runs`.
