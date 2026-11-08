import { latency, offlineGuard } from "@/services/api/client";
import { issueCategoryMeta } from "@/constants/issueCategories";
import type { ReportAIResult } from "@/types/report";
import type { IssueCategory } from "@/types/community";

export interface ReportAnalysisInput {
  categoryId: IssueCategory;
  title: string;
  priority: string;
  projectId: string | null;
}

const CATEGORY_PROJECT_HINTS: Partial<Record<IssueCategory, string>> = {
  pothole: "sinhgad-road",
  "road-damage": "sinhgad-road",
  "construction-quality": "katraj-kondhwa-road",
  "project-delay": "katraj-kondhwa-road",
  "work-stopped": "katraj-kondhwa-road",
  drainage: "kothrud-drainage",
  "water-leakage": "bhosari-water",
  "safety-hazard": "pune-metro-3",
  environmental: "pune-metro-3"
};

export async function analyzeReport(input: ReportAnalysisInput): Promise<ReportAIResult> {
  offlineGuard();
  await latency(1600, 2400);
  const cat = issueCategoryMeta(input.categoryId);
  const projectId = input.projectId ?? CATEGORY_PROJECT_HINTS[input.categoryId] ?? null;
  const detected = input.title.trim() !== "" ? input.title.trim() : `${cat.label} (from report text)`;
  return {
    detected,
    severity: input.priority === "high" || input.priority === "critical" ? "high" : input.priority === "medium" ? "medium" : "low",
    category: cat.label,
    // DF-16: this is an on-device heuristic (demo) — it measures neither a
    // confidence score nor duplicate reports, so both stay null.
    confidence: null,
    department: cat.department,
    projectId,
    duplicates: null
  };
}
