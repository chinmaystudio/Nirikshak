import type { CommunityIssue, CommunityIssueStatus, CommunityStats } from "@/types/community";
import { ApiError, offlineGuard } from "@/services/api/client";
import { supabase } from "@/core/supabase/client";

export type CommunityFeed = "all" | "recent" | "open" | "resolved";

/**
 * Community issues are REAL public complaints: rows from
 * `public_complaints_view` (the redacted public projection of `complaints`)
 * joined with project names/codes from `public_projects_view`.
 *
 * There is no community-interactions table, so there are no confirmations,
 * upvotes or comments here — the UI no longer offers them rather than
 * faking counts in localStorage.
 */

const STATUS_MAP: Record<string, CommunityIssueStatus> = {
  SUBMITTED: "open",
  UNDER_REVIEW: "open",
  ASSIGNED: "action-taken",
  INVESTIGATION: "action-taken",
  IN_PROGRESS: "action-taken",
  ACTION_TAKEN: "action-taken",
  ESCALATED: "open",
  RESOLVED: "resolved",
  CLOSED: "resolved",
  REJECTED: "resolved"
};

interface PublicComplaintRow {
  id: string;
  reference_number: string | null;
  project_id: string | null;
  category: string | null;
  title: string | null;
  severity: string | null;
  status: string | null;
  created_at: string | null;
}

let cache: CommunityIssue[] | null = null;

async function loadIssues(): Promise<CommunityIssue[]> {
  if (cache) return cache;

  // The generated DB types predate this view (same `as any` pattern as the
  // landing ReportsSection); the row shape is pinned by PublicComplaintRow.
  const { data: complaintRows, error: complaintsError } = await supabase
    .from("public_complaints_view" as any)
    .select("id, reference_number, project_id, category, title, severity, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (complaintsError) {
    throw new ApiError({ message: `Could not load community issues: ${complaintsError.message}` });
  }

  const rows = (complaintRows ?? []) as unknown as PublicComplaintRow[];
  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean))) as string[];

  const projectByUuid = new Map<string, { code: string | null; name: string | null }>();
  if (projectIds.length > 0) {
    const { data: projectRows, error: projectsError } = await supabase
      .from("public_projects_view")
      .select("id, nirikshak_project_id, project_name")
      .in("id", projectIds);
    if (projectsError) {
      throw new ApiError({ message: `Could not load linked projects: ${projectsError.message}` });
    }
    for (const p of (projectRows ?? []) as any[]) {
      projectByUuid.set(String(p.id), {
        code: p.nirikshak_project_id ? String(p.nirikshak_project_id) : null,
        name: p.project_name ? String(p.project_name) : null
      });
    }
  }

  cache = rows.map((r) => {
    const status = STATUS_MAP[String(r.status ?? "").toUpperCase()] ?? "open";
    const project = r.project_id ? projectByUuid.get(r.project_id) : undefined;
    const reportedAt = r.created_at ?? new Date(0).toISOString();
    return {
      id: r.reference_number || r.id,
      uuid: r.id,
      title: r.title || "—",
      category: r.category || "Other",
      severity: String(r.severity ?? "").toLowerCase(),
      projectId: project?.code ?? null,
      projectName: project?.name ?? null,
      status,
      reportedAt,
      timeline: [
        {
          id: "tl-reported",
          title: "Issue Reported",
          description: "Complaint registered on NIRIKSHAK and published to the community board.",
          date: reportedAt,
          status: "completed" as const
        },
        {
          id: "tl-status",
          title:
            status === "resolved"
              ? "Resolved"
              : status === "action-taken"
                ? "Department Action Under Way"
                : "Awaiting Department Action",
          description:
            status === "resolved"
              ? "The complaint is marked resolved in the public register."
              : "Current status as published in the public complaints register.",
          date: null,
          status: status === "resolved" ? ("completed" as const) : ("current" as const)
        }
      ]
    };
  });
  return cache;
}

export async function getCommunityFeed(feed: CommunityFeed): Promise<CommunityIssue[]> {
  offlineGuard();
  const all = await loadIssues();
  switch (feed) {
    case "open":
      return all.filter((i) => i.status !== "resolved");
    case "resolved":
      return all.filter((i) => i.status === "resolved");
    case "recent":
    case "all":
    default:
      return [...all];
  }
}

export async function getCommunityIssue(id: string): Promise<CommunityIssue> {
  offlineGuard();
  const all = await loadIssues();
  const found = all.find((i) => i.id === id || i.uuid === id);
  if (!found) {
    throw new ApiError({ message: "Community issue not found in the public register.", notFound: true });
  }
  return found;
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const all = await loadIssues();
  return {
    total: all.length,
    open: all.filter((i) => i.status !== "resolved").length,
    resolved: all.filter((i) => i.status === "resolved").length,
    linkedProjects: new Set(all.map((i) => i.projectId).filter(Boolean)).size
  };
}
