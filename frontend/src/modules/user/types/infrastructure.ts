import type { IssueCategory } from "./community";

export type AlertSeverity = "critical" | "warning" | "notice" | "info";

export type AlertCategory = "project" | "infrastructure" | "safety";

export interface GovernmentAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  body: string;
  area: string;
  detour?: string;
  startTime: string;
  endTime: string | null;
  postedAt: string;
  projectId: string | null;
  contact: string;
}

export interface VisionCondition {
  /** Derived from the AI result: "Attention Required" when the model listed
   * visible issues, otherwise "No visible issues". Never invented. */
  label: string;
  /** The model's real `visible_issues` list. */
  observations: string[];
}

export interface VisionAuthority {
  /** The backend AI's `authority_hint` — a hint, not a verified record. */
  hint: string;
}

export interface VisionProjectMatch {
  /** nirikshak_project_id (public code) of a real public_projects_view row. */
  projectId: string;
  /** Always null — matching is sector/GPS based, no measured confidence. */
  matchConfidence: number | null;
}

export type VisionImageSource = "camera" | "upload";

export interface VisionAnalysis {
  id: string;
  analyzedAt: string;
  imageSource: VisionImageSource;
  thumb: string | null;
  /** Backend AI `label`. */
  infrastructureLabel: string;
  shortLabel: string;
  /** Backend AI `infrastructure_type`. */
  infrastructureType: string;
  /** Backend AI confidence as a percentage (0–100), or null when the model
   * returned none — the UI renders "—", never an invented number. */
  confidence: number | null;
  /** Model that produced this analysis (backend response `model`). */
  model: string | null;
  /** Backend AI `condition_summary`. */
  description: string;
  condition: VisionCondition;
  authority: VisionAuthority;
  relatedProject: VisionProjectMatch | null;
  reportCategory: IssueCategory;
  saved: boolean;
  infoSubmitted: boolean;
}

export interface GovernmentAlertView extends GovernmentAlert {
  read: boolean;
}
