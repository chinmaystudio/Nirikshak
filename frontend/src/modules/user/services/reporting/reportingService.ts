import { issueCategoryMeta } from "@/constants/issueCategories";
import type { ReportReview } from "@/types/report";
import type { IssueCategory } from "@/types/community";

export interface ReportReviewInput {
  categoryId: IssueCategory;
  title: string;
  description: string;
  priority: string;
  projectId: string | null;
}

/** Severity is the citizen's own selected priority, carried through as-is. */
export function severityFromPriority(priority: string): ReportReview["severity"] {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

/**
 * Build the honest review shown before submission (U3 fix).
 *
 * This is a pure, synchronous projection of the citizen's own entries:
 * their title and description, the category they selected, the severity
 * derived from the priority they selected, and the project link only if
 * they actually selected a project in the report form. There is no AI
 * analysis, no confidence score, no duplicate check, and no
 * category-to-project guessing (the former hardcoded slug table pointed
 * at demo slugs that do not exist in the live database).
 */
export function buildReportReview(input: ReportReviewInput): ReportReview {
  const cat = issueCategoryMeta(input.categoryId);
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    category: cat.label,
    categoryId: input.categoryId,
    priority: input.priority,
    severity: severityFromPriority(input.priority),
    department: cat.department,
    projectId: input.projectId ? input.projectId : null
  };
}
