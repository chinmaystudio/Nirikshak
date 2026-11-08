import { z } from 'zod';

export const CreateProjectSchema = z.object({
  nirikshak_project_id: z.string().min(3),
  project_name: z.string().min(3),
  description: z.string().optional(),
  sector: z.string().min(2),
  subsector: z.string().optional(),
  project_authority: z.string().min(2),
  state: z.string().default('Maharashtra'),
  city: z.string().default('Pune'),
  location_text: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  total_cost_inr_crore: z.number().positive().optional(),
  // DF-20: collected by the government planning form; persisted to the
  // projects.technical_approval_date column (migration 033). The route
  // handler maps this camelCase field onto the snake_case column.
  technicalApprovalDate: z.string().optional(),
  planned_start_date: z.string().optional(),
  original_completion_date: z.string().optional(),
  is_public: z.boolean().default(true),
});

export const CreateTenderSchema = z.object({
  project_id: z.string().min(3).max(120),
  title: z.string().trim().min(3).max(240),
  estimated_value_inr_crore: z.number().positive(),
  mode: z.enum(['e-Tender', 'Manually', 'Global']).default('e-Tender'),
  description: z.string().trim().max(2000).optional(),
});

export const SubmitProgressSchema = z.object({
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional(),
  contractor_organization_id: z.string().uuid().optional(), // Derived server-side from active membership (Rule 26)
  reported_progress: z.number().min(0).max(100),
  description: z.string().min(5),
  evidence: z.array(z.object({
    evidence_type: z.enum(['photo', 'video', 'report', 'sensor', 'drone']),
    storage_path: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});

export const ReviewProgressSchema = z.object({
  progress_update_id: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED', 'CLARIFICATION_REQUIRED']),
  verified_progress: z.number().min(0).max(100).nullable().optional(),
  review_notes: z.string().min(2),
});

export const CreateComplaintSchema = z.object({
  project_id: z.string().uuid(),
  category: z.string().min(2),
  title: z.string().min(5),
  description: z.string().min(10),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  // DF-22: no client-supplied user_id. The complaints route derives the
  // author solely from the Bearer token (null for anonymous submissions);
  // trusting a body value would let anyone attribute a complaint to any user.
  evidence_paths: z.array(z.string()).optional(),
});

// Government bid evaluation (QCBS). combined_score is computed server-side
// as round(0.7 * technical + 0.3 * financial, 2); clients never send it.
export const EvaluateBidSchema = z.object({
  technical_score: z.number().min(0).max(100),
  financial_score: z.number().min(0).max(100),
});

export const RiskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']);

export const ProjectRiskAnalysisSchema = z.object({
  risk_score: z.number().min(0).max(100).nullable().optional(),
  risk_level: RiskLevelEnum,
  summary: z.string(),
  schedule: z.object({
    risk: RiskLevelEnum,
    reasons: z.array(z.string()),
  }),
  finance: z.object({
    risk: RiskLevelEnum,
    reasons: z.array(z.string()),
  }),
  environment: z.object({
    risk: RiskLevelEnum,
    reasons: z.array(z.string()),
  }),
  evidence: z.array(z.string()),
  recommended_actions: z.array(z.string()),
});

export type ProjectRiskAnalysis = z.infer<typeof ProjectRiskAnalysisSchema>;
