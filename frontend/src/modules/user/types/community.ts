import type { ComplaintPriority } from "./complaint";

export type IssueCategory =
  | "pothole"
  | "road-damage"
  | "construction-quality"
  | "project-delay"
  | "work-stopped"
  | "drainage"
  | "water-leakage"
  | "safety-hazard"
  | "environmental"
  | "other";

export interface IssueCategoryMeta {
  id: IssueCategory;
  label: string;
  icon: string;
  department: string;
  priority: ComplaintPriority;
}

export type CommunityIssueStatus = "open" | "confirmed" | "action-taken" | "resolved";

export interface CommunityEvidenceItem {
  name: string;
  meta: string;
  tone: string;
}

export interface CommunityConfirmation {
  name: string;
  ward: string;
  at: string;
  note: string;
}

export interface CommunityComment {
  author: string;
  ward?: string;
  at: string;
  text: string;
  official?: boolean;
  you?: boolean;
}

export interface GovernmentResponse {
  by: string;
  at: string;
  text: string;
}

export interface CommunityResolution {
  closedAt: string;
  note: string;
}

export interface CommunityIssueTimelineEntry {
  id: string;
  title: string;
  description: string;
  date: string | null;
  status: "completed" | "current" | "upcoming";
}

/**
 * A community issue IS a real public complaint row (public_complaints_view)
 * joined with its project (public_projects_view). The redacted public view
 * deliberately carries no reporter identity, description, evidence or
 * interaction counts — fields with no backing data are absent here rather
 * than fabricated.
 */
export interface CommunityIssue {
  /** Complaint reference number (public id). */
  id: string;
  /** Complaint UUID. */
  uuid: string;
  title: string;
  category: string;
  severity: string;
  /** Linked project's public code (nirikshak_project_id), when linked. */
  projectId: string | null;
  projectName: string | null;
  status: CommunityIssueStatus;
  reportedAt: string;
  timeline: CommunityIssueTimelineEntry[];
}

export type CommunityIssueView = CommunityIssue;

export interface CommunityStats {
  total: number;
  open: number;
  resolved: number;
  linkedProjects: number;
}
