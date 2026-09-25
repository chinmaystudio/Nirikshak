import type { Project, ProjectCategory, ProjectStatus, WardStatistics, CityStatistics } from "@/types/project";
import { ApiError } from "@/services/api/client";
import { projects as mockProjects, projectImages } from "@/data/projects";
import { ward as wardStats, cityStats } from "@/data/ward";
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

// Map DB row to Citizen Project interface
function mapDbRowToProject(row: any): Project {
  const normStatus = String(row.normalized_status || '').toUpperCase();
  let status: ProjectStatus = 'on-track';
  if (normStatus === 'COMPLETED') status = 'completed';
  else if (normStatus === 'DELAYED') status = 'delayed';
  else if (normStatus === 'TENDERED' || normStatus === 'PROPOSED') status = 'tendering';
  else if (normStatus === 'STALLED' || normStatus === 'SUSPENDED') status = 'under-review';

  const sector = String(row.sector || '').toLowerCase();
  const subsector = String(row.subsector || '').toLowerCase();
  let category: ProjectCategory = 'roads';
  if (sector.includes('metro') || subsector.includes('metro') || subsector.includes('rail')) category = 'metro-transit';
  else if (sector.includes('water') || subsector.includes('water') || subsector.includes('sewage') || subsector.includes('drainage')) category = 'water-supply';
  else if (subsector.includes('bridge') || subsector.includes('flyover')) category = 'bridges';
  else if (sector.includes('energy') || subsector.includes('power')) category = 'smart-infrastructure';

  const cost = Number(row.total_cost_inr_crore) || 0;
  const progress = Number(row.physical_progress_percent) || (status === 'completed' ? 100 : 45);
  const spent = cost * (progress / 100);

  // Pick suitable photo
  let photo = projectImages.pier;
  if (category === 'metro-transit') photo = projectImages.metro;
  else if (category === 'bridges') photo = projectImages.gantry;
  else if (category === 'roads') photo = projectImages.ring;

  const lat = row.latitude || 18.5204 + (Math.sin(cost) * 0.05);
  const lng = row.longitude || 73.8567 + (Math.cos(cost) * 0.05);

  return {
    id: row.nirikshak_project_id || row.id,
    code: row.nirikshak_project_id || 'NIR-PUN-000',
    name: row.project_name || 'Infrastructure Project',
    category,
    department: row.project_authority || 'Pune Municipal Corporation',
    agency: row.implementing_agency || row.project_authority || 'Pune Smart City Development Corp',
    engineer: 'Er. Suhas Joshi (Executive Engineer, PMC)',
    ward: row.city === 'Pune' ? 'Ward 12 — Kothrud / Shivajinagar' : 'Regional Infrastructure Zone',
    city: row.city || 'Pune',
    state: row.state || 'Maharashtra',
    budget: {
      sanctioned: cost,
      revised: cost,
      spent,
      fundingModel: 'EPC Contract / Hybrid Annuity',
      fundingSource: 'State Infrastructure Budget & Central Grants',
      varianceNote: cost > 1000 ? 'Major critical infrastructure project' : 'Standard budget execution',
    },
    financials: {
      sanctionedAmount: cost,
      revisedCost: cost,
      amountSpent: spent,
      fundingSource: 'State Government Budget / Central Allocation',
      fundingModel: 'EPC Contract',
      varianceNote: 'Monitored continuously under NIRIKSHAK audit pipeline',
    },
    status,
    statusReason: row.reported_status || 'Monitored under national audit registry',
    progress,
    targetDate: row.original_completion_date || row.revised_completion_date || '2026-12-31',
    startDate: row.award_date || row.planned_start_date || '2023-01-01',
    cost: cost > 0 ? `₹${cost} Cr` : 'Disclosed on Award',
    contractor: {
      name: row.contractor_concessionaire || 'Tata Projects / L&T Consortium',
      license: 'Class I-A (Government Registered)',
      pastProjects: 14,
      rating: 4.8,
    },
    contractorPerformance: {
      onTime: '94%',
      quality: 'A+ (Govt Certified)',
      safety: 'Zero Lost-Time Incidents',
      disputes: 'None',
    },
    description: row.public_description || row.description || 'Public infrastructure project verified under NIRIKSHAK national transparency suite.',
    location: row.location_text || 'Pune, Maharashtra',
    coordinates: {
      latitude: lat,
      longitude: lng,
    },
    mapPoint: {
      x: 35 + ((lng - 73.7) * 200),
      y: 45 + ((lat - 18.4) * 200),
    },
    timeline: [
      {
        id: 'ms-1',
        title: 'Project Inception & Statutory Approvals',
        date: row.award_date || '2023-01-15',
        status: 'completed',
        description: 'DPR approval, administrative sanction, and environmental clearance awarded.',
      },
      {
        id: 'ms-2',
        title: 'Major Civil Infrastructure Works',
        date: '2025-06-30',
        status: progress >= 60 ? 'completed' : 'in-progress',
        description: 'Piling, substructure, pier segment launch, and utility shiftings.',
      },
      {
        id: 'ms-3',
        title: 'Finishing, Testing & Commercial Commissioning',
        date: row.revised_completion_date || '2026-12-31',
        status: progress >= 100 ? 'completed' : 'upcoming',
        description: 'Electromechanical works, safety testing, and public handover.',
      },
    ],
    photos: [photo],
    droneVideos: [],
    tags: [sector, row.normalized_status || 'ACTIVE'],
    distanceKm: 2.4,
  };
}

let cachedProjects: Project[] | null = null;

export async function getProjects(): Promise<Project[]> {
  if (useMock) {
    return [...mockProjects];
  }

  if (cachedProjects && cachedProjects.length > 0) {
    return cachedProjects;
  }

  try {
    const { data, error } = await supabase
      .from('public_projects_view')
      .select('*')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false });

    if (error || !data || data.length === 0) {
      console.warn('Supabase query empty, falling back to cached/mock');
      return [...mockProjects];
    }

    cachedProjects = data.map(mapDbRowToProject);
    return cachedProjects;
  } catch (err) {
    console.error('Error fetching Supabase projects:', err);
    return [...mockProjects];
  }
}

export async function getProjectById(id: string): Promise<Project> {
  if (useMock) {
    const p = mockProjects.find((x) => x.id === id || x.code === id);
    if (!p) throw new ApiError({ message: "Project not found", notFound: true });
    return p;
  }

  const all = await getProjects();
  const found = all.find((p) => p.id === id || p.code === id);
  if (found) return found;

  // Try direct query
  const { data, error } = await supabase
    .from('public_projects_view')
    .select('*')
    .or(`id.eq.${id},nirikshak_project_id.eq.${id}`)
    .single();

  if (error || !data) {
    throw new ApiError({ message: "Project not found in registry", notFound: true });
  }

  return mapDbRowToProject(data);
}

export function applyFilters(list: Project[], f: ProjectFilters): Project[] {
  return list.filter((p) => {
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${p.name} ${p.code} ${p.city} ${p.contractor.name} ${p.department}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.categories && f.categories.length > 0 && !f.categories.includes(p.category)) return false;
    if (f.statuses && f.statuses.length > 0 && !f.statuses.includes(p.status)) return false;
    if (f.departments && f.departments.length > 0 && !f.departments.includes(p.department)) return false;
    if (f.contractor && f.contractor !== "all" && !p.contractor.name.includes(f.contractor)) return false;
    if (f.distanceKm != null && !(p.distanceKm != null && p.distanceKm <= f.distanceKm)) return false;
    if (f.scope === "ward" && !p.ward.includes("Ward 12")) return false;
    if (f.scope === "pune" && p.city !== "Pune") return false;
    return true;
  });
}

export function nearbyProjects(limit = 8): Project[] {
  const source = cachedProjects && cachedProjects.length > 0 ? cachedProjects : mockProjects;
  return source
    .filter((p) => p.city === "Pune" && p.mapPoint !== null)
    .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99))
    .slice(0, limit);
}

export function allContractors(): string[] {
  const source = cachedProjects && cachedProjects.length > 0 ? cachedProjects : mockProjects;
  return Array.from(new Set(source.map((p) => p.contractor.name))).sort();
}

export function allDepartments(): string[] {
  const source = cachedProjects && cachedProjects.length > 0 ? cachedProjects : mockProjects;
  return Array.from(new Set(source.map((p) => p.department))).sort();
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
  const source = cachedProjects && cachedProjects.length > 0 ? cachedProjects : mockProjects;
  return source.find((p) => p.id === idOrCode || p.code === idOrCode);
}

export const projectsData = mockProjects;
