import { humanHeaders } from "@/core/security/turnstile";
import type { VisionAnalysis, VisionImageSource } from "@/types/infrastructure";
import type { IssueCategory } from "@/types/community";
import { ApiError, fetchWithTimeout, offlineGuard } from "@/services/api/client";
import { environment } from "@/config/environment";
import { supabase } from "@/core/supabase/client";
import { compressImage } from "@/utils/download";
import { appStore } from "@/app/providers/store";

const MAX_HISTORY = 12;

export interface AnalyzeOptions {
  /** Full-resolution captured/uploaded image as a data URL. It is downscaled
   * to a max-1024px JPEG before being sent to the backend AI. */
  imageDataUrl: string;
  source: VisionImageSource;
  preferredProjectId?: string | null;
  /** GPS captured at scan time, when the user granted location access. */
  gps?: { lat: number; lng: number } | null;
  hint?: string;
}

interface VisionApiAnalysis {
  label: string;
  infrastructure_type: string;
  condition_summary: string;
  visible_issues: string[];
  authority_hint: string;
  confidence: number | null;
}

const ANALYSIS_STEPS: readonly string[] = [
  "Preparing photo",
  "Analyzing photo with AI",
  "Matching public project records"
];

export function analysisSteps(): readonly string[] {
  return ANALYSIS_STEPS;
}

function backendBase(): string {
  const baseUrl = environment.apiBaseUrl.replace(/\/$/, "");
  if (!baseUrl) {
    throw new ApiError({ message: "Vision service is not configured (missing API base URL)." });
  }
  return baseUrl;
}

/** Backend confidence arrives as a fraction (0–1) or a percentage; normalise
 * to a 0–100 percentage. Null stays null — the UI renders "—". */
function toPercent(confidence: number | null | undefined): number | null {
  if (confidence == null || Number.isNaN(Number(confidence))) return null;
  const n = Number(confidence);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

const CATEGORY_KEYWORDS: Array<{ match: RegExp; category: IssueCategory }> = [
  { match: /drain|sewer|storm/, category: "drainage" },
  { match: /water|pipeline|leak/, category: "water-leakage" },
  { match: /pothole/, category: "pothole" },
  { match: /road|bridge|flyover|street|highway|footpath|pavement/, category: "road-damage" },
  { match: /light|lamp|signal|electric|pole/, category: "safety-hazard" },
  { match: /construct|building|site/, category: "construction-quality" }
];

function reportCategoryFor(analysis: VisionApiAnalysis): IssueCategory {
  const hay = `${analysis.infrastructure_type} ${analysis.label}`.toLowerCase();
  for (const { match, category } of CATEGORY_KEYWORDS) {
    if (match.test(hay)) return category;
  }
  return "other";
}

interface ProjectCandidate {
  code: string;
  sectorText: string;
  lat: number | null;
  lng: number | null;
}

async function loadProjectCandidates(): Promise<ProjectCandidate[]> {
  const { data, error } = await supabase
    .from("public_projects_view")
    .select("nirikshak_project_id, sector, subsector, latitude, longitude")
    .limit(4000);
  if (error || !data) return [];
  return data
    .filter((r: any) => r.nirikshak_project_id)
    .map((r: any) => ({
      code: String(r.nirikshak_project_id),
      sectorText: `${r.sector ?? ""} ${r.subsector ?? ""}`.toLowerCase(),
      lat: r.latitude != null ? Number(r.latitude) : null,
      lng: r.longitude != null ? Number(r.longitude) : null
    }));
}

function sectorMatches(candidate: ProjectCandidate, infrastructureType: string): boolean {
  const tokens = infrastructureType
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 4 && !["public", "urban", "rural"].includes(t));
  return tokens.some((t) => candidate.sectorText.includes(t));
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Match the scan to a REAL public_projects_view row — never an invented one.
 * Order: an explicitly requested project wins; with GPS, the nearest project
 * (sector-matching rows preferred); without GPS there is no honest way to
 * pick one project out of thousands, so the result stays unmatched.
 */
async function matchProject(
  analysis: VisionApiAnalysis,
  opts: AnalyzeOptions
): Promise<VisionAnalysis["relatedProject"]> {
  const candidates = await loadProjectCandidates();
  if (candidates.length === 0) return null;

  if (opts.preferredProjectId) {
    const preferred = candidates.find((c) => c.code === opts.preferredProjectId);
    if (preferred) return { projectId: preferred.code, matchConfidence: null };
  }

  if (opts.gps) {
    const withCoords = candidates.filter((c) => c.lat != null && c.lng != null);
    if (withCoords.length === 0) return null;
    const sectorFirst = withCoords.filter((c) => sectorMatches(c, analysis.infrastructure_type));
    const pool = sectorFirst.length > 0 ? sectorFirst : withCoords;
    let best: ProjectCandidate | null = null;
    let bestKm = Number.POSITIVE_INFINITY;
    for (const c of pool) {
      const km = distanceKm(opts.gps, { lat: c.lat as number, lng: c.lng as number });
      if (km < bestKm) {
        bestKm = km;
        best = c;
      }
    }
    return best ? { projectId: best.code, matchConfidence: null } : null;
  }

  return null;
}

export async function analyzeInfrastructure(opts: AnalyzeOptions): Promise<VisionAnalysis> {
  offlineGuard();
  const baseUrl = backendBase();

  const image = await compressImage(opts.imageDataUrl, 1024, 0.82);

  const human = await humanHeaders();
  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/api/ai/vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...human },
      body: JSON.stringify({ image, ...(opts.hint ? { hint: opts.hint } : {}) })
    });
  } catch {
    throw new ApiError({ message: "Vision service is temporarily unavailable. Please try again." });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !result?.data?.analysis) {
    throw new ApiError({
      message: result?.error?.message || `Vision analysis failed (HTTP ${response.status}).`,
      status: response.status,
      code: result?.error?.code
    });
  }

  const analysis = result.data.analysis as VisionApiAnalysis;
  const issues = Array.isArray(analysis.visible_issues) ? analysis.visible_issues : [];
  const relatedProject = await matchProject(analysis, opts);

  return {
    id: `VIS-${Date.now().toString(36).toUpperCase()}`,
    analyzedAt: new Date().toISOString(),
    imageSource: opts.source,
    thumb: null,
    infrastructureLabel: analysis.label || analysis.infrastructure_type || "Infrastructure",
    shortLabel: analysis.label || analysis.infrastructure_type || "Infrastructure",
    infrastructureType: analysis.infrastructure_type || "",
    confidence: toPercent(analysis.confidence),
    model: typeof result.data.model === "string" ? result.data.model : null,
    description: analysis.condition_summary || "",
    condition: {
      label: issues.length > 0 ? "Attention Required" : "No visible issues",
      observations: issues
    },
    authority: { hint: analysis.authority_hint || "" },
    relatedProject,
    reportCategory: reportCategoryFor(analysis),
    saved: true,
    infoSubmitted: false
  };
}

export async function analyzeWithSteps(
  opts: AnalyzeOptions,
  onStep: (step: string, index: number) => void
): Promise<VisionAnalysis> {
  onStep(ANALYSIS_STEPS[0], 0);
  onStep(ANALYSIS_STEPS[1], 1);
  const result = await analyzeInfrastructure(opts);
  onStep(ANALYSIS_STEPS[2], 2);
  saveResult(result);
  return result;
}

export function getVisionHistory(): VisionAnalysis[] {
  return appStore.getState().vision;
}

export function saveResult(result: VisionAnalysis): VisionAnalysis {
  const list = appStore.getState().vision;
  if (!list.some((r) => r.id === result.id)) {
    appStore.setState({ vision: [result, ...list].slice(0, MAX_HISTORY) });
  }
  return result;
}

export function getVisionResult(id: string): VisionAnalysis | null {
  return appStore.getState().vision.find((r) => r.id === id) ?? null;
}

export function markInfoSubmitted(id: string): VisionAnalysis | null {
  const vision = appStore.getState().vision.map((r) => (r.id === id ? { ...r, infoSubmitted: true } : r));
  appStore.setState({ vision });
  return vision.find((r) => r.id === id) ?? null;
}

export function latestResult(): VisionAnalysis | null {
  return appStore.getState().vision[0] ?? null;
}
