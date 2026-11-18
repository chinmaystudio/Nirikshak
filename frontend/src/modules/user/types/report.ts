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

/**
 * Honest review of a citizen's own report entries (U3 fix).
 * Every field is copied or deterministically derived from what the
 * citizen themselves entered — there is no AI analysis, no confidence
 * score, no duplicate check, and no guessed project link.
 */
export interface ReportReview {
  /** The citizen's own title, exactly as entered. */
  title: string;
  /** The citizen's own description, exactly as entered. */
  description: string;
  /** Label of the category the citizen selected. */
  category: string;
  categoryId: IssueCategory;
  /** The priority the citizen selected in the report form. */
  priority: string;
  /** Derived directly from `priority` — labelled as such in the UI. */
  severity: "critical" | "high" | "medium" | "low";
  /** Department for the category the citizen selected. */
  department: string;
  /**
   * Only the project the citizen actually selected in the report form
   * (or arrived with via a real project link). Never guessed.
   */
  projectId: string | null;
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
  submittedId: string | null;
  submitting: boolean;
}

export type { ComplaintPriority, IssueCategory };
