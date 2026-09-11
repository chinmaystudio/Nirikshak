import type { Project, ProjectCategory, ProjectStatus, WardStatistics, CityStatistics } from "@/types/project";
import { ApiError, latency, offlineGuard } from "@/services/api/client";
import { projects, findProject } from "@/data/projects";
import { ward as wardStats, cityStats } from "@/data/ward";

export type ProjectFilters = {
  q?: string;
  categories?: ProjectCategory[];
  statuses?: ProjectStatus[];
  departments?: string[];
  contractor?: string;
  distanceKm?: number | null;
  scope?: "ward" | "pune" | "all";
};

export async function getProjects(): Promise<Project[]> {
  offlineGuard();
  await latency(300, 600);
  return [...projects];
}

export async function getProjectById(id: string): Promise<Project> {
  offlineGuard();
  await latency(250, 500);
  const project = findProject(id);
  if (!project) {
    throw new ApiError({ message: "Project not found. It may have been archived or the link is incorrect.", notFound: true });
  }
  return project;
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
  return projects
    .filter((p) => p.city === "Pune" && p.mapPoint !== null)
    .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99))
    .slice(0, limit);
}

export function allContractors(): string[] {
  return Array.from(new Set(projects.map((p) => p.contractor.name))).sort();
}

export function allDepartments(): string[] {
  return Array.from(new Set(projects.map((p) => p.department))).sort();
}

export function toCsv(list: Project[]): string {
  const head = ["Code", "Project", "Category", "Department", "City", "Ward", "Status", "Progress %", "Sanctioned (Cr)", "Revised (Cr)", "Spent (Cr)", "Contractor"];
  const rows = list.map((p) => [
    p.code,
    p.name,
    p.category,
    p.department,
    p.city,
    p.ward,
    p.status,
    String(p.progress),
    String(p.finance.sanctionedAmount),
    String(p.finance.revisedCost),
    String(p.finance.amountSpent),
    p.contractor.name
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

export function getWardStatistics(): WardStatistics {
  return wardStats;
}

export function getCityStatistics(): CityStatistics {
  return cityStats;
}

export const projectsData = projects;
export { findProject };
