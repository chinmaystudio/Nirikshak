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
  planned_start_date: z.string().optional(),
  original_completion_date: z.string().optional(),
  is_public: z.boolean().default(true),
});

export const SubmitProgressSchema = z.object({
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional(),
  contractor_organization_id: z.string().uuid(),
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
  decision: z.enum(['APPROVED', 'REJECTED', 'REQUEST_CLARIFICATION']),
  verified_progress: z.number().min(0).max(100),
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
  user_id: z.string().uuid().optional(),
  evidence_paths: z.array(z.string()).optional(),
});

export const SubmitBidSchema = z.object({
  tender_id: z.string().uuid(),
  contractor_organization_id: z.string().uuid(),
  bid_amount: z.number().positive(),
  technical_score: z.number().min(0).max(100).optional(),
  financial_score: z.number().min(0).max(100).optional(),
});

export const ProjectRiskAnalysisSchema = z.object({
  risk_score: z.number().min(0).max(100),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  summary: z.string(),
  schedule: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    reasons: z.array(z.string()),
  }),
  finance: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    reasons: z.array(z.string()),
  }),
  environment: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    reasons: z.array(z.string()),
  }),
  evidence: z.array(z.string()),
  recommended_actions: z.array(z.string()),
});

export type ProjectRiskAnalysis = z.infer<typeof ProjectRiskAnalysisSchema>;
