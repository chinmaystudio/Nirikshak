import type { Project, ProjectCategory, ProjectStatus, WardStatistics, CityStatistics } from "@/types/project";
import { ApiError } from "@/services/api/client";
import { currentUser } from "@/services/auth/authService";
import { supabase } from "@/core/supabase/client";

export type ProjectFilters = {
  q?: string;
  categories?: ProjectCategory[];
  statuses?: ProjectStatus[];
  departments?: string[];
  contractor?: string;
  distanceKm?: number | null;
  scope?: "ward" | "pune" | "all";
  /** The signed-in user's own ward label (from their profile), if set. */
  ward?: string | null;
};

/**
 * Ward-scope matching uses the USER's ward from their profile — never a
 * hard-coded ward. A ward label like "Ward 12 — Kothrud West" yields the
 * tokens ["ward 12", "kothrud west"], matched against the project's real
 * location text / city. No ward on the profile → no ward filtering (the
 * caller degrades to a wider scope instead of inventing a ward).
 */
export function matchesWard(p: Project, wardLabel?: string | null): boolean {
  if (!wardLabel) return true;
  const tokens = wardLabel
    .split("—")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2);
  if (tokens.length === 0) return true;
  const hay = `${p.ward || ""} ${p.city || ""}`.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DF-02 / DF-24: map a public_projects_view row to the citizen Project model
 * using ONLY values the view actually returns. Fields the view does not
 * publish stay empty / null / 0 (rendered as — or hidden by the UI) — never
 * invented contractor names, engineers, distances, dates, funding splits,
 * grades, documents or inspection results.
 */
function mapDbRowToProject(row: any): Project {
  const normStatus = String(row.normalized_status || '').toUpperCase();
  let status: ProjectStatus = 'on-track';
  if (normStatus === 'COMPLETED') status = 'completed';
  else if (normStatus === 'DELAYED') status = 'delayed';
  else if (normStatus === 'TENDERED' || normStatus === 'AWARDED' || normStatus === 'PROPOSED') status = 'tendering';
  else if (normStatus === 'STALLED' || normStatus === 'SUSPENDED') status = 'under-review';

  const sector = String(row.sector || '').toLowerCase();
  const subsector = String(row.subsector || '').toLowerCase();
  let category: ProjectCategory = 'roads';
  if (sector.includes('metro') || subsector.includes('metro') || subsector.includes('rail')) category = 'metro-transit';
  else if (sector.includes('water') || subsector.includes('water') || subsector.includes('sewage') || subsector.includes('drainage')) category = 'water-supply';
  else if (subsector.includes('bridge') || subsector.includes('flyover')) category = 'bridges';
  else if (sector.includes('energy') || subsector.includes('power')) category = 'smart-infrastructure';

  const cost = Number(row.total_cost_inr_crore) || 0;
  const progress = row.physical_progress_percent != null
    ? Number(row.physical_progress_percent)
    : status === 'completed' ? 100 : 0;
  // Migration 033 added real spend columns to the view — use them as-is.
  const spent = row.amount_spent_inr_crore != null ? Number(row.amount_spent_inr_crore) || 0 : 0;
  const financialProgress = row.financial_progress_percent != null ? Number(row.financial_progress_percent) || 0 : 0;
  const revisedCost = row.revised_cost_inr_crore != null ? Number(row.revised_cost_inr_crore) || 0 : 0;

  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;

  const projCode = row.nirikshak_project_id || row.id || '';
  const originalEnd = row.original_completion_date || '';
  const revisedEnd = row.revised_completion_date || originalEnd;
  const startDate = row.award_date || row.planned_start_date || '';

  return {
    id: projCode,
    code: projCode,
    name: row.project_name || '—',
    category,
    department: row.project_authority || '—',
    agency: row.implementing_agency || row.project_authority || '—',
    engineer: '',
    ward: row.location_text || row.district || '—',
    city: row.city || '',
    state: row.state || '',
    status,
    progress,
    physicalProgress: progress,
    financialProgress,
    phase: status === 'completed' ? 'Completed' : progress > 0 ? 'In execution' : 'Yet to start',
    // No user location is known at this layer — never invent a distance.
    distanceKm: null,
    mapPoint: lat != null && lng != null ? {
      x: Math.min(92, Math.max(8, Math.round(35 + ((lng - 73.7) * 200)))),
      y: Math.min(92, Math.max(8, Math.round(45 + ((lat - 18.4) * 200)))),
    } : null,
    img: null,
    latestUpdate: {
      date: row.updated_at || '',
      text: row.public_description || ''
    },
    lastInspection: {
      date: '',
      by: '',
      remark: ''
    },
    nextMilestone: {
      name: '',
      date: revisedEnd
    },
    description: row.description || row.public_description || '',
    why: '',
    scope: [],
    benefit: '',
    finance: {
      sanctionedAmount: cost,
      revisedCost,
      amountSpent: spent,
      fundingSource: '',
      fundingModel: '',
      varianceNote: ''
    },
    contractor: {
      name: row.contractor_name || row.contractor_concessionaire || '—',
      contractValue: 0,
      start: startDate,
      duration: '',
      performance: {
        onTime: '',
        quality: '',
        safety: '',
        disputes: ''
      },
      prevProjects: [],
      currentStatus: ''
    },
    dates: {
      tender: '',
      awarded: row.award_date || '',
      started: row.planned_start_date || '',
      expected: revisedEnd,
      actual: row.actual_completion_date || null,
      originalExpected: originalEnd,
      revisedExpected: revisedEnd
    },
    timeline: [],
    docs: [],
    photos: [],
    hotline: ''
  };
}

let cachedProjects: Project[] | null = null;

const PAGE_SIZE = 1000;

export async function getProjects(): Promise<Project[]> {
  if (cachedProjects) {
    return cachedProjects;
  }

  // DF-33: page through the view with .range() until a short page returns,
  // instead of a single .limit(4000) fetch that silently drops projects.
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('public_projects_view')
      .select('*')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // DF-09: surface the failure — never substitute bundled mock projects.
      throw new ApiError({ message: `Could not load projects: ${error.message}` });
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  cachedProjects = rows.map(mapDbRowToProject);
  return cachedProjects;
}

export async function getProjectById(id: string): Promise<Project> {
  if (cachedProjects) {
    const found = cachedProjects.find((p) => p.id === id || p.code === id);
    if (found) return found;
  }

  // DF-14 pattern: query the UUID column only for UUID values, else the
  // public code column alone (a code in an id.eq slot errors on the UUID cast).
  const query = supabase.from('public_projects_view').select('*');
  const { data, error } = await (UUID_RE.test(id)
    ? query.eq('id', id).single()
    : query.eq('nirikshak_project_id', id).single());

  if (error || !data) {
    if (error && (error as any).code && (error as any).code !== 'PGRST116') {
      throw new ApiError({ message: `Could not load project: ${error.message}` });
    }
    throw new ApiError({ message: "Project not found in registry", notFound: true });
  }

  return mapDbRowToProject(data);
}

export function applyFilters(list: Project[], f: ProjectFilters): Project[] {
  return list.filter((p) => {
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${p.name || ''} ${p.code || ''} ${p.city || ''} ${p.contractor?.name || ''} ${p.department || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.categories && f.categories.length > 0 && !f.categories.includes(p.category)) return false;
    if (f.statuses && f.statuses.length > 0 && !f.statuses.includes(p.status)) return false;
    if (f.departments && f.departments.length > 0 && !f.departments.includes(p.department)) return false;
    if (f.contractor && f.contractor !== "all" && !(p.contractor?.name || '').includes(f.contractor)) return false;
    if (f.distanceKm != null && !(p.distanceKm != null && p.distanceKm <= f.distanceKm)) return false;
    if (f.scope === "ward" && !matchesWard(p, f.ward)) return false;
    if (f.scope === "pune" && p.city !== "Pune") return false;
    return true;
  });
}

export function nearbyProjects(limit = 8, projectList?: Project[]): Project[] {
  const source = (projectList && projectList.length > 0) ? projectList : (cachedProjects ?? []);
  return source
    .filter((p) => (p.city === "Pune" || !p.city) && p.mapPoint !== null)
    .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99))
    .slice(0, limit);
}

export function allContractors(projectList?: Project[]): string[] {
  const source = (projectList && projectList.length > 0) ? projectList : (cachedProjects ?? []);
  return Array.from(new Set(source.map((p) => p.contractor?.name).filter((n) => n && n !== '—') as string[])).sort();
}

export function allDepartments(projectList?: Project[]): string[] {
  const source = (projectList && projectList.length > 0) ? projectList : (cachedProjects ?? []);
  return Array.from(new Set(source.map((p) => p.department).filter((d) => d && d !== '—'))).sort();
}

/* ------------------------------------------------------------------ */
/* Ward / city statistics — computed from REAL public data only.       */
/* Projects: public_projects_view. Complaints: public_complaints_view. */
/* Nothing here is a bundled constant any more (audit U5).             */
/* ------------------------------------------------------------------ */

interface StatsProjectRow {
  id: string;
  city: string | null;
  district: string | null;
  normalized_status: string | null;
  total_cost_inr_crore: number | null;
  amount_spent_inr_crore: number | null;
  physical_progress_percent: number | null;
  contractor_name: string | null;
  contractor_concessionaire: string | null;
}

async function loadStatsProjectRows(): Promise<StatsProjectRow[]> {
  const rows: StatsProjectRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // select("*"): the generated view type predates migration 033's real
    // spend columns; the row shape is pinned by StatsProjectRow instead.
    const { data, error } = await supabase
      .from("public_projects_view")
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new ApiError({ message: `Could not load project statistics: ${error.message}` });
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as StatsProjectRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function complaintCountsForProjects(projectIds: string[]): Promise<{ total: number; resolved: number }> {
  if (projectIds.length === 0) return { total: 0, resolved: 0 };
  let total = 0;
  let resolved = 0;
  // Chunk the IN list so a large city never builds an oversized query.
  for (let i = 0; i < projectIds.length; i += 200) {
    const chunk = projectIds.slice(i, i + 200);
    // `as any`: the generated DB types predate public_complaints_view
    // (same pattern as the landing ReportsSection).
    const { data, error } = await supabase
      .from("public_complaints_view" as any)
      .select("status")
      .in("project_id", chunk);
    if (error) throw new ApiError({ message: `Could not load complaint statistics: ${error.message}` });
    for (const row of (data ?? []) as unknown as Array<{ status: string | null }>) {
      total += 1;
      const s = String(row.status ?? "").toUpperCase();
      if (s === "RESOLVED" || s === "CLOSED") resolved += 1;
    }
  }
  return { total, resolved };
}

function statusBuckets(rows: StatsProjectRow[]): { onTrack: number; delayed: number; critical: number; completed: number } {
  let onTrack = 0;
  let delayed = 0;
  let critical = 0;
  let completed = 0;
  for (const r of rows) {
    const s = String(r.normalized_status ?? "").toUpperCase();
    if (s === "COMPLETED") completed += 1;
    else if (s === "DELAYED") delayed += 1;
    else if (s === "STALLED" || s === "SUSPENDED") critical += 1;
    else onTrack += 1;
  }
  return { onTrack, delayed, critical, completed };
}

/**
 * Statistics for the signed-in user's own city/district, computed from real
 * rows. Returns null when the user's city is unknown or has no published
 * projects — the UI must then not show a "your area" card at all, rather
 * than falling back to an invented ward.
 */
export async function getWardStats(): Promise<WardStatistics | null> {
  const user = currentUser();
  const place = (user?.city ?? "").trim();
  if (!place) return null;
  const needle = place.toLowerCase();

  const all = await loadStatsProjectRows();
  const rows = all.filter(
    (r) =>
      (r.city ?? "").trim().toLowerCase() === needle ||
      (r.district ?? "").trim().toLowerCase() === needle
  );
  if (rows.length === 0) return null;

  const { onTrack, delayed, critical, completed } = statusBuckets(rows);
  const totalValueCr = rows.reduce((acc, r) => acc + (Number(r.total_cost_inr_crore) || 0), 0);
  const spentCr = rows.reduce((acc, r) => acc + (Number(r.amount_spent_inr_crore) || 0), 0);
  const complaints = await complaintCountsForProjects(rows.map((r) => r.id));

  const byContractor = new Map<string, { projects: number; progressSum: number }>();
  for (const r of rows) {
    const name = (r.contractor_name || r.contractor_concessionaire || "").trim();
    if (!name || name === "—") continue;
    const entry = byContractor.get(name) ?? { projects: 0, progressSum: 0 };
    entry.projects += 1;
    entry.progressSum += Number(r.physical_progress_percent) || 0;
    byContractor.set(name, entry);
  }
  const contractors = Array.from(byContractor.entries())
    .map(([name, e]) => ({ name, projects: e.projects, avgProgress: Math.round(e.progressSum / e.projects) }))
    .sort((a, b) => b.projects - a.projects)
    .slice(0, 5);

  return {
    id: `place-${needle.replace(/\s+/g, "-")}`,
    name: place,
    projects: rows.length,
    onTrack,
    delayed,
    critical,
    completed,
    totalValueCr: Math.round(totalValueCr * 100) / 100,
    spentFYCr: Math.round(spentCr * 100) / 100,
    expenditurePct: totalValueCr > 0 ? Math.round((spentCr / totalValueCr) * 100) : 0,
    complaints: complaints.total,
    resolved: complaints.resolved,
    resolutionRate: complaints.total > 0 ? Math.round((complaints.resolved / complaints.total) * 100) : 0,
    avgDays: null,
    activeComplaints: complaints.total - complaints.resolved,
    contractors,
    statusSplit: [
      { label: "On Track", value: onTrack, className: "bg-secondary" },
      { label: "Completed", value: completed, className: "bg-green-600" },
      { label: "Delayed", value: delayed, className: "bg-error" },
      { label: "Critical Review", value: critical, className: "bg-info" }
    ]
  };
}
export const getWardStatistics = getWardStats;

/** Portal-wide aggregates over the same real views (no ward scoping). */
export async function getCityStats(): Promise<CityStatistics> {
  const rows = await loadStatsProjectRows();
  const { critical, completed } = statusBuckets(rows);
  const complaints = await complaintCountsForProjects(rows.map((r) => r.id));
  return {
    activeProjects: rows.length - completed,
    completed,
    underReview: critical,
    issuesResolved: complaints.resolved,
    avgRedressalDays: null
  };
}
export const getCityStatistics = getCityStats;

export function findProject(idOrCode: string): Project | undefined {
  const source = cachedProjects ?? [];
  return source.find((p) => p.id === idOrCode || p.code === idOrCode);
}

