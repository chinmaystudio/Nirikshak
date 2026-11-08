import type { Project, ProjectCategory, ProjectStatus, WardStatistics, CityStatistics } from "@/types/project";
import { ApiError } from "@/services/api/client";
import { projects as mockProjects } from "../../data/projects";
import { ward as wardStats, cityStats } from "../../data/ward";
import { supabase } from "@/core/supabase/client";

const useMock = import.meta.env.VITE_USE_MOCK_API === 'true';

export type ProjectFilters = {
  q?: string;
  categories?: ProjectCategory[];
  statuses?: ProjectStatus[];
  departments?: string[];
  contractor?: string;
  distanceKm?: number | null;
  scope?: "ward" | "pune" | "all";
};

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
  // The view publishes no spend figure (DF-24): amount spent stays 0-labelled.
  const spent = 0;

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
    financialProgress: 0,
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
    description: row.public_description || '',
    why: '',
    scope: [],
    benefit: '',
    finance: {
      sanctionedAmount: cost,
      revisedCost: 0,
      amountSpent: spent,
      fundingSource: '',
      fundingModel: '',
      varianceNote: ''
    },
    contractor: {
      name: row.contractor_concessionaire || '—',
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
  if (useMock) {
    return [...mockProjects];
  }

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
  if (useMock) {
    const p = mockProjects.find((x) => x.id === id || x.code === id);
    if (!p) throw new ApiError({ message: "Project not found", notFound: true });
    return p;
  }

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
    if (f.scope === "ward" && !(p.ward || '').includes("Ward 12")) return false;
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

export function getWardStats(): WardStatistics {
  return wardStats;
}
export const getWardStatistics = getWardStats;

export function getCityStats(): CityStatistics {
  return cityStats;
}
export const getCityStatistics = getCityStats;


export function findProject(idOrCode: string): Project | undefined {
  const source = cachedProjects ?? [];
  return source.find((p) => p.id === idOrCode || p.code === idOrCode);
}

/** Bundled demo fixture — only for explicit demo mode / prefill name lookups. */
export const projectsData = mockProjects;

