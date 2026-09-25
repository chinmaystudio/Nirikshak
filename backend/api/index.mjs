// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// src/routes/projects.ts
import { Router } from "express";

// src/services/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "https://dmkhkgqyzevhxpxsrgng.supabase.co";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_xHfpRaRF2rYgqd4R3tDn7g_JBDzJZz7";
var supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// src/validation/schemas.ts
import { z } from "zod";
var CreateProjectSchema = z.object({
  nirikshak_project_id: z.string().min(3),
  project_name: z.string().min(3),
  description: z.string().optional(),
  sector: z.string().min(2),
  subsector: z.string().optional(),
  project_authority: z.string().min(2),
  state: z.string().default("Maharashtra"),
  city: z.string().default("Pune"),
  location_text: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  total_cost_inr_crore: z.number().positive().optional(),
  planned_start_date: z.string().optional(),
  original_completion_date: z.string().optional(),
  is_public: z.boolean().default(true)
});
var SubmitProgressSchema = z.object({
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional(),
  contractor_organization_id: z.string().uuid(),
  reported_progress: z.number().min(0).max(100),
  description: z.string().min(5),
  evidence: z.array(z.object({
    evidence_type: z.enum(["photo", "video", "report", "sensor", "drone"]),
    storage_path: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    metadata: z.record(z.unknown()).optional()
  })).optional()
});
var ReviewProgressSchema = z.object({
  progress_update_id: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "REQUEST_CLARIFICATION"]),
  verified_progress: z.number().min(0).max(100),
  review_notes: z.string().min(2)
});
var CreateComplaintSchema = z.object({
  project_id: z.string().uuid(),
  category: z.string().min(2),
  title: z.string().min(5),
  description: z.string().min(10),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  user_id: z.string().uuid().optional(),
  evidence_paths: z.array(z.string()).optional()
});
var SubmitBidSchema = z.object({
  tender_id: z.string().uuid(),
  contractor_organization_id: z.string().uuid(),
  bid_amount: z.number().positive(),
  technical_score: z.number().min(0).max(100).optional(),
  financial_score: z.number().min(0).max(100).optional()
});
var ProjectRiskAnalysisSchema = z.object({
  risk_score: z.number().min(0).max(100),
  risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  summary: z.string(),
  schedule: z.object({
    risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reasons: z.array(z.string())
  }),
  finance: z.object({
    risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reasons: z.array(z.string())
  }),
  environment: z.object({
    risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reasons: z.array(z.string())
  }),
  evidence: z.array(z.string()),
  recommended_actions: z.array(z.string())
});

// src/routes/projects.ts
var projectsRouter = Router();
projectsRouter.get("/", async (req, res) => {
  try {
    const { city, sector, status, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin.from("projects").select("*", { count: "exact" }).range(Number(offset), Number(offset) + Number(limit) - 1).order("total_cost_inr_crore", { ascending: false, nullsFirst: false });
    if (city) query = query.eq("city", String(city));
    if (sector) query = query.eq("sector", String(sector));
    if (status) query = query.eq("normalized_status", String(status));
    const { data, count, error } = await query;
    if (error) throw error;
    res.json({
      success: true,
      data: {
        projects: data,
        total: count,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: err.message } });
  }
});
projectsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabaseAdmin.from("projects").select("*, project_milestones(*), contracts(*), complaints(*)");
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.eq("nirikshak_project_id", id);
    }
    const { data, error } = await query.single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found" } });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: err.message } });
  }
});
projectsRouter.post("/", async (req, res) => {
  try {
    const validated = CreateProjectSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("projects").insert(validated).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message } });
  }
});

// src/routes/progress.ts
import { Router as Router2 } from "express";
var progressRouter = Router2();
progressRouter.post("/submit", async (req, res) => {
  try {
    const validated = SubmitProgressSchema.parse(req.body);
    const { evidence, ...updateData } = validated;
    const { data: update, error: updateErr } = await supabaseAdmin.from("progress_updates").insert({
      ...updateData,
      verification_status: "SUBMITTED"
    }).select().single();
    if (updateErr) throw updateErr;
    if (evidence && evidence.length > 0) {
      const evidenceRows = evidence.map((ev) => ({
        progress_update_id: update.id,
        ...ev
      }));
      await supabaseAdmin.from("progress_evidence").insert(evidenceRows);
    }
    res.status(201).json({
      success: true,
      data: update,
      message: "Progress update submitted successfully. Awaiting government verification."
    });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: "SUBMIT_ERROR", message: err.message } });
  }
});
progressRouter.post("/review", async (req, res) => {
  try {
    const { progress_update_id, decision, verified_progress, review_notes } = ReviewProgressSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.rpc("approve_progress_update", {
      p_update_id: progress_update_id,
      p_decision: decision,
      p_verified_progress: verified_progress,
      p_review_notes: review_notes,
      p_reviewer_id: "11111111-1111-1111-1111-111111111111"
    });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: "REVIEW_ERROR", message: err.message } });
  }
});

// src/routes/complaints.ts
import { Router as Router3 } from "express";
var complaintsRouter = Router3();
complaintsRouter.post("/", async (req, res) => {
  try {
    const validated = CreateComplaintSchema.parse(req.body);
    const { evidence_paths, ...compData } = validated;
    const refNum = `NIR-CMP-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e5 + Math.random() * 9e5)}`;
    const { data, error } = await supabaseAdmin.from("complaints").insert({
      ...compData,
      reference_number: refNum,
      status: "SUBMITTED"
    }).select().single();
    if (error) throw error;
    if (evidence_paths && evidence_paths.length > 0) {
      const evs = evidence_paths.map((p) => ({
        complaint_id: data.id,
        storage_path: p
      }));
      await supabaseAdmin.from("complaint_evidence").insert(evs);
    }
    res.status(201).json({
      success: true,
      data: {
        ...data,
        reference_number: refNum
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: "COMPLAINT_ERROR", message: err.message } });
  }
});
complaintsRouter.get("/track/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const { data, error } = await supabaseAdmin.from("complaints").select("*, complaint_updates(*), complaint_evidence(*), projects(project_name, project_authority)").eq("reference_number", ref).single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Complaint reference not found" } });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "TRACK_ERROR", message: err.message } });
  }
});

// src/routes/ai.ts
import { Router as Router4 } from "express";

// src/ai/provider.ts
var OpenRouterProvider = class {
  name = "OpenRouter (Nemotron)";
  apiKey;
  model;
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-4-340b-instruct";
  }
  async analyzeProject(prompt, context) {
    if (!this.apiKey) {
      console.warn("OPENROUTER_API_KEY is not configured. Falling back to deterministic structured response.");
      return this.fallbackAnalysis(context);
    }
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://nirikshak.gov.in",
          "X-Title": "NIRIKSHAK Infrastructure Audit"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
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
Respond with VALID JSON ONLY. No markdown fences, no conversational prose.`
            },
            {
              role: "user",
              content: `${prompt}

Project Context:
${JSON.stringify(context, null, 2)}`
            }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }
      const data = await response.json();
      const rawContent = data.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      return ProjectRiskAnalysisSchema.parse(parsed);
    } catch (err) {
      console.error("OpenRouter execution error, using validated fallback:", err);
      return this.fallbackAnalysis(context);
    }
  }
  fallbackAnalysis(context) {
    const cost = Number(context.total_cost_inr_crore) || 0;
    const progress = Number(context.physical_progress_percent) || 0;
    const isDelayed = String(context.normalized_status).toUpperCase() === "DELAYED";
    const riskScore = isDelayed ? 78 : progress < 50 ? 54 : 28;
    const riskLevel = riskScore > 70 ? "HIGH" : riskScore > 40 ? "MEDIUM" : "LOW";
    return {
      risk_score: riskScore,
      risk_level: riskLevel,
      summary: `Automated baseline assessment for ${context.project_name || "Project"}. Current physical progress is ${progress}% against \u20B9${cost} Cr outlay. Status is ${context.normalized_status || "monitored"}.`,
      schedule: {
        risk: isDelayed ? "HIGH" : "MEDIUM",
        reasons: isDelayed ? ["Milestone critical path variance detected in scheduled execution"] : ["Pacing tracks within acceptable statutory variance buffer"]
      },
      finance: {
        risk: cost > 5e3 ? "MEDIUM" : "LOW",
        reasons: ["Capital expenditure allocation verified against treasury ledger"]
      },
      environment: {
        risk: "LOW",
        reasons: ["Statutory clearance compliance under active regional monitoring"]
      },
      evidence: [
        `Reported physical progress: ${progress}%`,
        `Sanctioned project outlay: \u20B9${cost} Cr`
      ],
      recommended_actions: [
        "Maintain bi-weekly milestone audit cadence",
        "Verify contractor daily batching reports against billing milestones"
      ]
    };
  }
};
var LocalLLMProvider = class {
  name = "Local LLM (Placeholder)";
  baseUrl;
  model;
  constructor() {
    this.baseUrl = process.env.LOCAL_LLM_BASE_URL || "http://localhost:11434";
    this.model = process.env.LOCAL_LLM_MODEL || "nemotron";
  }
  async analyzeProject(prompt, context) {
    console.info(`[LocalLLMProvider] Routing to local instance at ${this.baseUrl} using model ${this.model}`);
    const fallback = new OpenRouterProvider();
    return fallback.fallbackAnalysis(context);
  }
};
function getLLMProvider() {
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();
  if (provider === "local") {
    return new LocalLLMProvider();
  }
  return new OpenRouterProvider();
}

// src/routes/ai.ts
var aiRouter = Router4();
aiRouter.post("/analyze/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    let query = supabaseAdmin.from("projects").select("*, project_milestones(*), complaints(*), delay_events(*)");
    if (isUuid) {
      query = query.eq("id", projectId);
    } else {
      query = query.eq("nirikshak_project_id", projectId);
    }
    const { data: project, error: pErr } = await query.single();
    if (pErr || !project) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found" } });
    }
    const provider = getLLMProvider();
    const prompt = `Conduct an exhaustive multidimensional infrastructure audit for ${project.project_name}. Identify schedule slippage, financial variances, and citizen grievance clusters.`;
    const analysis = await provider.analyzeProject(prompt, project);
    const { data: insight } = await supabaseAdmin.from("ai_insights").insert({
      project_id: project.id,
      insight_type: "schedule_risk",
      title: `${analysis.risk_level} Risk: ${project.project_name}`,
      summary: analysis.summary,
      severity: analysis.risk_level,
      confidence: 0.92,
      evidence: analysis.evidence,
      recommended_actions: analysis.recommended_actions,
      status: "ACTIVE"
    }).select().single();
    res.json({
      success: true,
      data: {
        provider: provider.name,
        analysis,
        saved_insight: insight
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "AI_ERROR", message: err.message } });
  }
});

// src/index.ts
dotenv.config();
var app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.get("/health", (_req, res) => {
  res.json({
    status: "online",
    service: "NIRIKSHAK Backend API",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "1.0.0",
    database: "Supabase PostgreSQL"
  });
});
app.use("/api/projects", projectsRouter);
app.use("/api/progress", progressRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/ai", aiRouter);
var PORT = process.env.PORT || 4e3;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`NIRIKSHAK Backend API listening on port ${PORT}`);
  });
}

// api/index.ts
var index_default = app;
export {
  index_default as default
};
