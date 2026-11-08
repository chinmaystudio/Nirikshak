import type { ComplaintPriority } from "./complaint";
import type { IssueCategory } from "./community";

export interface EvidenceDraftItem {
  id: string;
  name: string;
  size: string;
  kind: "image" | "video";
  thumb?: string | null;
  meta?: string;
  fromVision?: boolean;
}

export interface ReportAIResult {
  detected: string;
  severity: "high" | "medium" | "low";
  category: string;
  /** DF-16: null — the on-device heuristic produces no measured confidence. */
  confidence: number | null;
  department: string;
  projectId: string | null;
  /** DF-16: null — duplicates are not actually checked by the heuristic. */
  duplicates: number | null;
}

export interface ReportPin {
  x: number;
  y: number;
  lat: string;
  lng: string;
}

export interface ReportDraft {
  step: number;
  categoryId: IssueCategory | null;
  title: string;
  description: string;
  priority: ComplaintPriority;
  projectId: string;
  address: string;
  ward: string;
  gps: string | null;
  pin: ReportPin | null;
  evidence: EvidenceDraftItem[];
  aiResult: ReportAIResult | null;
  submittedId: string | null;
  submitting: boolean;
}

export type { ComplaintPriority, IssueCategory };
