import { supabase } from '@/core/supabase/client';
import { isMissingFunction } from '@/core/supabase/compat';
import type {
  Project,
  Paginated,
  ListQuery,
  ApprovalItem,
  Tender,
  Grievance,
  FundFlow,
  BillItem,
  AuditFinding,
  AlertItem,
  DocumentItem,
  LitigationCase,
  WorkOrder,
  InspectionRecord,
  AiInsight,
  CitizenProjectSummary,
  Officer,
  Contractor,
  ContractorEvaluation,
  BudgetHead,
  MonthlySpend,
  SiteProgressUpdate,
  ProjectActivityEntry,
  Milestone,
  OfficerOption,
} from '@/modules/government/types';
import { normalizeProjectStatus } from '@/core/status/projectStatus';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only when the value can safely be used against a UUID column (DF-14). */
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Finite number from a DB value, or 0 when the column is absent/not numeric. */
function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build an Error from a backend JSON envelope (DF-18): the message carries
 * the backend message and the machine-readable code is preserved on
 * `err.code` (and in the message) so callers can distinguish e.g.
 * 409 ACCOUNT_EXISTS from 503 AI_UNAVAILABLE.
 */
function backendError(result: any, response: Response, fallback: string): Error & { code?: string; status?: number } {
  const code: string | undefined = result?.error?.code || undefined;
  const message: string = result?.error?.message || fallback;
  const err = new Error(code ? `${message} [${code}]` : message) as Error & { code?: string; status?: number };
  if (code) err.code = code;
  err.status = response.status;
  return err;
}

/** Supabase session Bearer token, using the same pattern as the fetch callers. */
async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return accessToken;
}

export interface CreateGovernmentProjectInput {
  name: string;
  department: string;
  district: string;
  category: string;
  amountCr: number;
  adminApprovalDate: string;
  technicalApprovalDate?: string;
  expectedCompletion: string;
  summary?: string;
}

// Helper to map DB project to Government Portal Project type.
// DF-34/DF-02: every field is a real DB value or an honest empty/zero —
// no invented contractors, funding splits, milestones, dates or counts.
function mapDbProject(db: any): Project {
  const cost = numberOrZero(db.total_cost_inr_crore);
  const physPct = numberOrZero(db.physical_progress_percent);
  const spent = numberOrZero(db.amount_spent_inr_crore);
  const finPct = db.financial_progress_percent != null
    ? numberOrZero(db.financial_progress_percent)
    : cost > 0
      ? (spent / cost) * 100
      : 0;
  const status = mapNormalizedStatus(db.normalized_status);

  const dept = db.department || db.project_authority || db.implementing_agency || '';
  const dist = db.district || db.city || '';
  const distLower = dist.toLowerCase();
  let division = '';
  if (distLower.includes('nashik') || distLower.includes('ahmednagar') || distLower.includes('dhule') || distLower.includes('jalgaon')) division = 'Nashik';
  else if (distLower.includes('nagpur') || distLower.includes('wardha') || distLower.includes('chandrapur') || distLower.includes('bhandara')) division = 'Nagpur';
  else if (distLower.includes('amravati') || distLower.includes('akola') || distLower.includes('yavatmal') || distLower.includes('buldhana')) division = 'Amravati';
  else if (distLower.includes('sambhajinagar') || distLower.includes('aurangabad') || distLower.includes('jalna') || distLower.includes('nanded') || distLower.includes('latur')) division = 'Chhatrapati Sambhajinagar';
  else if (distLower.includes('mumbai') || distLower.includes('thane') || distLower.includes('palghar') || distLower.includes('raigad')) division = 'Konkan';
  else if (distLower.includes('pune') || distLower.includes('satara') || distLower.includes('solapur') || distLower.includes('kolhapur') || distLower.includes('sangli')) division = 'Pune';
  else if (db.state) division = db.state;

  const plannedEnd = db.original_completion_date || db.revised_completion_date || '';
  // Real delay only: revised completion later than the original date.
  let delayDays = 0;
  if (db.original_completion_date && db.revised_completion_date) {
    const diffMs = new Date(db.revised_completion_date).getTime() - new Date(db.original_completion_date).getTime();
    if (Number.isFinite(diffMs) && diffMs > 0) delayDays = Math.round(diffMs / 86_400_000);
  }
  const projId = db.nirikshak_project_id || db.id;
  const revisedCost = db.revised_cost_inr_crore != null ? numberOrZero(db.revised_cost_inr_crore) : undefined;

  return {
    id: projId,
    dbId: db.id || undefined,
    name: db.project_name || '',
    department: dept,
    district: dist,
    division,
    category: db.sector || db.subsector || '',
    status,
    sanctionedAmountCr: cost,
    utilizedAmountCr: spent,
    physicalProgressPct: physPct,
    financialProgressPct: finPct,
    adminApprovalDate: db.award_date || db.planned_start_date || '',
    // No technical-approval date column exists on projects — never derive
    // one from planned_start_date (DF-34/DF-20).
    technicalApprovalDate: db.technical_approval_date || '',
    expectedCompletion: plannedEnd,
    actualCompletion: db.actual_completion_date || undefined,
    contractor: db.contractor_concessionaire || undefined,
    riskLevel: status === 'delayed' ? 'high' : status === 'at_risk' ? 'medium' : 'low',
    delayDays,
    workOrderNo: undefined,
    summary: db.description || db.public_summary || db.public_description || '',
    financials: {
      sanctionedAmountCr: cost,
      revisedAmountCr: revisedCost,
      amountUtilizedCr: spent,
      amountCommittedCr: 0,
      fundingSources: [],
      lastTrancheDate: undefined,
      nextTrancheDueCr: undefined,
    },
    milestones: [],
    inspectionsCount: numberOrZero(db.pending_inspections_count),
    openComplaints: numberOrZero(db.open_complaints_count),
    pendingApprovals: numberOrZero(db.pending_progress_updates_count),
    documentsCount: 0,
  };
}

/**
 * Translate a UI project status to the normalized_status enum value(s) it
 * can be stored as (DF-27) — exact .in matching, never ilike substrings
 * (e.g. 'in_execution' never substring-matches 'UNDER_CONSTRUCTION').
 */
// Values are restricted to members of the 001 project_status enum so the
// filter stays valid on either DB lineage (enum or text — see migration 029).
const UI_STATUS_TO_NORMALIZED: Record<string, string[]> = {
  sanctioned: ['PROPOSED', 'DPR_STAGE', 'APPROVED'],
  in_execution: ['UNDER_CONSTRUCTION'],
  delayed: ['DELAYED'],
  at_risk: ['STALLED', 'SUSPENDED'],
  completed: ['COMPLETED'],
  on_hold: ['UNKNOWN', 'OTHER', 'CANCELLED'],
  tendered: ['TENDERED'],
  awarded: ['AWARDED'],
};

function mapNormalizedStatus(status: string): Project['status'] {
  const shared = normalizeProjectStatus(status);
  return shared === 'unknown' ? 'on_hold' : shared;
}

export const projectsApi = {
  async create(input: CreateGovernmentProjectInput): Promise<Project> {
    if (!API_BASE_URL) {
      throw new Error('Project creation service is temporarily unavailable.');
    }

    const accessToken = await getAccessToken();

    const projectId = `NIR-GOV-${Date.now().toString(16).toUpperCase()}`;
    // 60s timeout: backend cold starts (Render/Vercel) can be slow.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nirikshak_project_id: projectId,
        project_name: input.name,
        description: input.summary || undefined,
        sector: input.category,
        project_authority: input.department,
        state: 'Maharashtra',
        city: input.district,
        location_text: `${input.district}, Maharashtra`,
        total_cost_inr_crore: input.amountCr,
        planned_start_date: input.adminApprovalDate,
        // DF-20: the form collects a technical approval date — send it
        // (both key spellings; the backend schema/insert is the other half).
        technicalApprovalDate: input.technicalApprovalDate || undefined,
        technical_approval_date: input.technicalApprovalDate || undefined,
        original_completion_date: input.expectedCompletion,
        is_public: true,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.data) {
      throw backendError(result, response, 'Project could not be created. Please try again.');
    }

    return mapDbProject(result.data);
  },

  async all(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('government_project_summary_view')
      .select('*')
      .is('source_record_id', null)
      .or('record_scope.is.null,record_scope.neq.DEMO')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to load projects: ${error.message}`);
    }

    return (data || []).map(mapDbProject);
  },

  async list(q?: ListQuery): Promise<Paginated<Project>> {
    const page = q?.page ?? 1;
    const pageSize = q?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('government_project_summary_view').select('*', { count: 'exact' });
    query = query.is('source_record_id', null).or('record_scope.is.null,record_scope.neq.DEMO');

    if (q?.search) {
      query = query.or(`project_name.ilike.%${q.search}%,location_text.ilike.%${q.search}%,nirikshak_project_id.ilike.%${q.search}%`);
    }

    const statusFilter = q?.filters?.status?.[0];
    if (statusFilter) {
      // DF-27: translate the UI status to stored enum value(s); exact match.
      const normalized = UI_STATUS_TO_NORMALIZED[statusFilter.toLowerCase()];
      if (normalized) {
        query = query.in('normalized_status', normalized as any);
      } else {
        query = query.eq('normalized_status', statusFilter.toUpperCase() as any);
      }
    }

    const { data, count, error } = await query
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }

    const items = (data || []).map(mapDbProject);
    const total = count || items.length;
    return {
      items,
      total,
      page,
      pageSize,
    };
  },

  async get(id: string): Promise<Project | undefined> {
    // DF-14: a non-UUID value must never be cast against the UUID id column.
    let query = supabase.from('government_project_summary_view').select('*');
    query = isUuid(id) ? query.eq('id', id) : query.eq('nirikshak_project_id', id);
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to load project: ${error.message}`);
    }
    return data ? mapDbProject(data) : undefined;
  },

  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const updatePayload: Record<string, unknown> = {};
    if (patch.name) updatePayload.project_name = patch.name;
    if (patch.sanctionedAmountCr !== undefined) updatePayload.total_cost_inr_crore = patch.sanctionedAmountCr;
    if (patch.physicalProgressPct !== undefined) updatePayload.physical_progress_percent = patch.physicalProgressPct;

    // DF-14: query the UUID id column only for UUID values, else the code column alone.
    let query = supabase.from('projects').update(updatePayload as any);
    query = isUuid(id) ? query.eq('id', id) : query.eq('nirikshak_project_id', id);
    const { data, error } = await query
      .select()
      .single();

    if (error) throw error;
    return mapDbProject(data);
  },

  async add(p: Omit<Project, 'id'>): Promise<Project> {
    const newId = `NIR-GOV-${Date.now().toString(16).toUpperCase()}`;
    const { data, error } = await supabase
      .from('projects')
      .insert({
        nirikshak_project_id: newId,
        project_name: p.name,
        sector: p.category || 'Urban Infrastructure',
        project_authority: p.department || 'Pune Municipal Corporation',
        total_cost_inr_crore: p.sanctionedAmountCr,
        physical_progress_percent: p.physicalProgressPct,
        location_text: `${p.district}, Maharashtra`,
        is_public: true,
      })
      .select()
      .single();

    if (error) throw error;
    return mapDbProject(data);
  },
};

export const approvalsApi = {
  async all(): Promise<ApprovalItem[]> {
    const { data, error } = await supabase
      .from('progress_updates')
      .select('*, projects(project_name, nirikshak_project_id), project_milestones(milestone_name)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load approvals: ${error.message}`);
    }

    return (data || []).map((u: any) => ({
      id: u.id,
      type: 'Technical Sanction / Progress Verification',
      projectId: u.projects?.nirikshak_project_id || u.project_id,
      projectName: u.projects?.project_name || 'Not available',
      submittedBy: 'Not available',
      submittedOn: (u.created_at || '').slice(0, 10),
      status: u.verification_status === 'APPROVED' ? 'approved' : u.verification_status === 'REJECTED' ? 'rejected' : 'pending',
      slaDueDate: '',
      assignedTo: 'Not assigned',
      priority: 'high',
      auditTrail: [
        {
          timestamp: u.created_at || '',
          actor: 'Contractor organization',
          role: 'Submitter',
          action: 'Submitted progress update',
          remarks: u.description || 'No remarks supplied',
        },
      ],
    }));
  },

  async list(q?: ListQuery): Promise<Paginated<ApprovalItem>> {
    const all = await this.all();
    const page = q?.page ?? 1; const pageSize = q?.pageSize ?? 20;
    const filtered = q?.search ? all.filter((item) => `${item.id} ${item.projectName} ${item.type}`.toLowerCase().includes(q.search!.toLowerCase())) : all;
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
  },

  async get(id: string): Promise<ApprovalItem | undefined> {
    return (await this.all()).find((item) => item.id === id);
  },

  async pending(): Promise<ApprovalItem[]> {
    const all = await this.all();
    return all.filter((a) => a.status === 'pending');
  },

  async approve(id: string, notes = 'Approved after verification.'): Promise<void> {
    const { error } = await supabase.rpc('approve_progress_update', {
      p_update_id: id,
      p_decision: 'APPROVED',
      p_verified_progress: null,
      p_review_notes: notes,
    });
    if (error) throw error;
  },

  async reject(id: string, notes = 'Rejected.'): Promise<void> {
    const { error } = await supabase.rpc('approve_progress_update', {
      p_update_id: id,
      p_decision: 'REJECTED',
      p_verified_progress: null,
      p_review_notes: notes,
    });
    if (error) throw error;
  },
};

export const grievancesApi = {
  async all(): Promise<Grievance[]> {
    const { data, error } = await supabase
      .from('complaints')
      .select('*, projects(project_name, nirikshak_project_id)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load grievances: ${error.message}`);
    }

    return (data || []).map((c: any) => {
      const sev = String(c.severity || '').toLowerCase();
      const priority: Grievance['priority'] = sev === 'critical' ? 'urgent' : sev === 'high' ? 'high' : sev === 'low' ? 'low' : 'medium';
      const st = String(c.status || '').toUpperCase();
      const status: Grievance['status'] = st === 'RESOLVED' ? 'resolved' : st === 'IN_PROGRESS' ? 'action_taken' : 'submitted';

      return {
        id: c.reference_number || c.id,
        // DF-06: keep the row's UUID alongside the reference number so
        // writes can match the UUID id column exactly.
        dbId: c.id || undefined,
        referenceNumber: c.reference_number || undefined,
        projectId: c.projects?.nirikshak_project_id || c.project_id || undefined,
        category: c.category || 'Quality of Work',
        status,
        subject: c.title || 'Public Works Grievance',
        description: c.description || 'Grievance submitted regarding infrastructure status.',
        submittedOn: (c.created_at || '').slice(0, 10),
        submittedBy: '(identity protected)',
        slaDeadline: '',
        assignedTo: c.assigned_user_id || 'Not assigned',
        priority,
        district: 'Not available',
        timeline: [
          {
            timestamp: c.created_at || '',
            actor: 'System',
            action: 'Grievance registered and geolocated',
            note: 'Submitted through the citizen portal',
          },
        ],
        attachments: 0,
      };
    });
  },

  async get(id: string): Promise<Grievance | undefined> {
    const all = await this.all();
    return all.find((g) => g.id === id || g.dbId === id || g.referenceNumber === id);
  },

  async update(id: string, patch: Partial<Grievance>): Promise<Grievance> {
    // DF-06: resolve the row's UUID first (from the patch, a UUID argument,
    // or a lookup by display id/reference) — the UPDATE itself matches the
    // UUID id column only, and its error is never swallowed.
    let uuid: string | undefined = patch.dbId && isUuid(patch.dbId) ? patch.dbId : isUuid(id) ? id : undefined;
    if (!uuid) {
      const existing = await this.get(id);
      uuid = existing?.dbId;
    }
    if (!uuid) {
      throw new Error(`Grievance ${id} could not be found.`);
    }
    if (patch.status) {
      const dbStatus = patch.status === 'resolved' ? 'RESOLVED' : patch.status === 'action_taken' ? 'IN_PROGRESS' : 'SUBMITTED';
      // Status changes go through update_complaint_status (migration 040),
      // which checks the officer's rights and records the status history.
      const { error } = await supabase.rpc('update_complaint_status' as never, {
        p_complaint_id: uuid,
        p_status: dbStatus,
        p_note: (patch as { note?: string }).note ?? null,
      } as never);
      if (error && isMissingFunction(error)) {
        // Database without migration 040: direct update (previous behaviour).
        const { error: legacyError } = await supabase.from('complaints').update({ status: dbStatus }).eq('id', uuid);
        if (legacyError) throw legacyError;
      } else if (error) {
        throw error;
      }
    }
    const found = await this.get(uuid);
    if (!found) {
      throw new Error(`Grievance ${id} could not be reloaded after the update.`);
    }
    return found;
  },
};

export const citizenApi = {
  async all(): Promise<CitizenProjectSummary[]> {
    const { data, error } = await supabase
      .from('public_projects_view')
      .select('*')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to load public projects: ${error.message}`);
    }

    return (data || []).map((p: any) => ({
      id: p.nirikshak_project_id || p.id,
      name: p.project_name,
      department: p.project_authority || p.department || 'Not available',
      district: p.district || p.city || 'Not available',
      status: mapNormalizedStatus(p.normalized_status),
      physicalProgressPct: Number(p.physical_progress_percent) || 0,
      sanctionedAmountCr: Number(p.total_cost_inr_crore) || 0,
      expectedCompletion: p.original_completion_date || p.revised_completion_date || '',
      contractor: p.contractor_concessionaire || 'Not available',
      scope: p.public_summary || p.public_description || p.description || 'Not available',
      publicMilestones: [],
    }));
  },

  async get(id: string): Promise<CitizenProjectSummary | undefined> {
    const all = await this.all();
    return all.find((p) => p.id === id);
  },

  async trackGrievance(ref: string): Promise<Grievance | undefined> {
    return grievancesApi.get(ref);
  },

  async projects(q?: ListQuery): Promise<Paginated<CitizenProjectSummary>> {
    const all = await this.all(); const page = q?.page ?? 1; const pageSize = q?.pageSize ?? 20;
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  },

  async submitGrievanceInput(_input?: {
    subject?: string;
    description?: string;
    projectId?: string;
  }): Promise<Grievance> {
    throw new Error('Use the canonical /user/report flow to submit a grievance.');
  },
};

function matchesQuery<T extends object>(items: T[], q?: ListQuery): T[] {
  if (!q?.search) return items;
  const s = q.search.toLowerCase();
  return items.filter((item) =>
    Object.values(item as Record<string, unknown>).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes(s),
    ),
  );
}

function paginate<T>(items: T[], q?: ListQuery): Paginated<T> {
  const page = q?.page ?? 1;
  const pageSize = q?.pageSize ?? 20;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/* ---------- Auth ---------- */
/**
 * The officer is derived from the real Supabase session: profiles row for
 * the signed-in user plus their active organization_members roles. There
 * is no demo officer — without a session there is no officer.
 */
async function officerFromSession(): Promise<Officer | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('organization_members')
      .select('role, organizations(name, department)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);
  const firstMembership: any = (memberships || [])[0];
  return {
    id: user.id,
    name: profile?.full_name || user.email || 'Officer',
    designation: firstMembership?.role || '',
    department: firstMembership?.organizations?.department || firstMembership?.organizations?.name || '',
    employeeNo: '',
    roles: (memberships || []).map((m: any) => String(m.role)).filter(Boolean),
  };
}

export const authApi = {
  async signIn(_employeeId: string, _password: string): Promise<Officer> {
    // Real sign-in happens through the core AuthService / login pages; this
    // surface only resolves the already-authenticated officer.
    const officer = await officerFromSession();
    if (!officer) throw new Error('No active session. Please sign in first.');
    return officer;
  },
  async currentOfficer(): Promise<Officer | null> {
    return officerFromSession();
  },
};

/* ---------- Contractors ---------- */
/**
 * Real contractor register: organizations (type='contractor') joined with
 * contracts and project_organizations, aggregated client-side. Every field
 * is a stored value or an aggregate of stored values — nothing invented.
 */
async function loadContractorData() {
  const [{ data: orgs, error: orgError }, { data: contracts, error: contractError }, { data: links, error: linkError }] =
    await Promise.all([
      supabase.from('organizations').select('*').eq('type', 'contractor').order('name'),
      supabase
        .from('contracts')
        .select('id, project_id, contractor_organization_id, contract_value, status')
        .is('deleted_at', null),
      supabase.from('project_organizations').select('project_id, organization_id, relationship'),
    ]);
  if (orgError) throw new Error(`Failed to load contractors: ${orgError.message}`);
  if (contractError) throw new Error(`Failed to load contracts: ${contractError.message}`);
  if (linkError) throw new Error(`Failed to load project organisations: ${linkError.message}`);

  const projectIds = new Set<string>();
  (contracts || []).forEach((c: any) => c.project_id && projectIds.add(c.project_id));
  (links || []).forEach((l: any) => l.project_id && projectIds.add(l.project_id));

  const projectsById = new Map<string, any>();
  if (projectIds.size > 0) {
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, nirikshak_project_id, project_name, normalized_status, physical_progress_percent')
      .in('id', [...projectIds]);
    if (projectError) throw new Error(`Failed to load contractor projects: ${projectError.message}`);
    (projects || []).forEach((p: any) => projectsById.set(p.id, p));
  }
  return { orgs: orgs || [], contracts: contracts || [], links: links || [], projectsById };
}

function aggregateContractor(org: any, contracts: any[], links: any[], projectsById: Map<string, any>) {
  const ownContracts = contracts.filter((c: any) => c.contractor_organization_id === org.id);
  const projectIdSet = new Set<string>();
  ownContracts.forEach((c: any) => c.project_id && projectIdSet.add(c.project_id));
  links
    .filter((l: any) => l.organization_id === org.id)
    .forEach((l: any) => l.project_id && projectIdSet.add(l.project_id));

  const projectRows = [...projectIdSet]
    .map((pid) => ({ pid, row: projectsById.get(pid), contract: ownContracts.find((c: any) => c.project_id === pid) }))
    .filter((x) => x.row);
  const completed = projectRows.filter((x) => x.row.normalized_status === 'COMPLETED');
  const active = projectRows.filter(
    (x) => x.row.normalized_status !== 'COMPLETED' && x.row.normalized_status !== 'CANCELLED',
  );
  const progressValues = projectRows
    .map((x) => Number(x.row.physical_progress_percent))
    .filter((n) => Number.isFinite(n));
  const averageProgressPct = progressValues.length
    ? Math.round((progressValues.reduce((s, n) => s + n, 0) / progressValues.length) * 10) / 10
    : null;

  return { ownContracts, projectIdSet, projectRows, completed, active, averageProgressPct };
}

export const contractorsApi = {
  async all(): Promise<Contractor[]> {
    const { orgs, contracts, links, projectsById } = await loadContractorData();
    return orgs.map((org: any) => {
      const agg = aggregateContractor(org, contracts, links, projectsById);
      return {
        id: org.id,
        name: org.name,
        registrationNo: org.registration_number ?? null,
        verified: Boolean(org.verified),
        empanelledSince: org.created_at ? String(org.created_at).slice(0, 10) : null,
        district: org.district ?? null,
        state: org.state ?? null,
        department: org.department ?? null,
        projectIds: [...agg.projectIdSet],
        assignedProjects: agg.projectIdSet.size,
        activeProjects: agg.active.length,
        completedProjects: agg.completed.length,
        totalValueCr: agg.ownContracts.reduce((s: number, c: any) => s + numberOrZero(c.contract_value), 0),
        activeContracts: agg.ownContracts.filter((c: any) => c.status === 'ACTIVE').length,
        averageProgressPct: agg.averageProgressPct,
      };
    });
  },
  async list(q?: ListQuery): Promise<Paginated<Contractor>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
  /** Evaluation computed entirely from real portal records for one contractor. */
  async evaluate(contractorId: string): Promise<ContractorEvaluation | undefined> {
    const { orgs, contracts, links, projectsById } = await loadContractorData();
    const org = orgs.find((o: any) => o.id === contractorId);
    if (!org) return undefined;
    const agg = aggregateContractor(org, contracts, links, projectsById);
    const assigned = agg.projectIdSet.size;
    return {
      contractorId,
      assignedProjects: assigned,
      completedProjects: agg.completed.length,
      activeProjects: agg.active.length,
      activeContracts: agg.ownContracts.filter((c: any) => c.status === 'ACTIVE').length,
      totalContractValueCr: agg.ownContracts.reduce((s: number, c: any) => s + numberOrZero(c.contract_value), 0),
      averageProgressPct: agg.averageProgressPct,
      completionRatePct: assigned > 0 ? Math.round((agg.completed.length / assigned) * 1000) / 10 : null,
      projects: agg.projectRows.map((x) => ({
        id: x.row.nirikshak_project_id || x.pid,
        name: x.row.project_name || '',
        status: x.row.normalized_status || '',
        progressPct: numberOrZero(x.row.physical_progress_percent),
        contractValueCr: x.contract ? numberOrZero(x.contract.contract_value) : null,
        contractStatus: x.contract?.status ?? null,
      })),
    };
  },
  async create(input: { name: string; registrationNo?: string }): Promise<void> {
    const { error } = await supabase.from('organizations').insert({
      name: input.name,
      type: 'contractor',
      registration_number: input.registrationNo || null,
    });
    if (error) throw error;
  },
};

/** JSON call to the backend with the caller's token; throws backend messages. */
async function backendJson(method: string, path: string, body: unknown, fallback: string): Promise<any> {
  if (!API_BASE_URL) throw new Error('This service is temporarily unavailable.');
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw backendError(result, response, fallback);
  return result?.data ?? result;
}

/* ---------- Tenders ---------- */
export const tendersApi = {
  async all(): Promise<Tender[]> {
    try {
      const [{ data, error }, { data: bidData, error: bidError }, { data: contractData, error: contractError }, { data: countData, error: countError }] = await Promise.all([
        supabase
          .from('tenders')
          .select('*, projects(nirikshak_project_id, district, sector, project_authority)')
          .order('publication_date', { ascending: false }),
        supabase
          .from('tender_bids')
          .select('id, tender_id, bid_amount, status, technical_score, financial_score, contractor_organization_id, organizations(name)')
          .is('deleted_at', null),
        supabase
          .from('contracts')
          // selected_bid_id arrives with migration 030 — not selected yet so
          // this query stays valid on the current live schema.
          .select('id, tender_id, contract_value, contractor_organization_id, organizations(name)')
          .is('deleted_at', null),
        // Sealed bidding: bid rows are invisible until opened, so counts and
        // committee status come from a function that reveals no bid content.
        supabase.rpc('get_tender_bid_counts' as never),
      ]);
      if (error) throw error;
      if (bidError) throw bidError;
      // The contracts read is auxiliary (award enrichment): if it is not
      // readable for this role, awarded fields still populate from the
      // SELECTED bid rather than failing the whole tender register.
      if (contractError) console.error('Contracts read for tender awards failed:', contractError);
      // Before migration 042 the counts function does not exist: keep the
      // previous behaviour (bids visible once the tender is closed/past due).
      const sealedBidding = !countError || !isMissingFunction(countError);
      if (countError && sealedBidding) console.error('Tender bid counts failed:', countError);
      const countsByTender = new Map<string, any>();
      ((countData as any[] | null) || []).forEach((c: any) => countsByTender.set(c.tender_id, c));
      if (data) {
        const bidsByTender = new Map<string, any[]>();
        (bidData || []).forEach((bid: any) => {
          const rows = bidsByTender.get(bid.tender_id) || [];
          rows.push(bid);
          bidsByTender.set(bid.tender_id, rows);
        });
        const contractsByTender = new Map<string, any>();
        (contractData || []).forEach((contract: any) => {
          if (contract.tender_id) contractsByTender.set(contract.tender_id, contract);
        });

        return data.map((t: any) => {
          const bids = bidsByTender.get(t.id) || [];
          const counts = countsByTender.get(t.id);
          // Bids are shown only after the committee has opened them.
          const bidOpeningAllowed = sealedBidding
            ? Boolean(t.bids_opened_at)
            : ['CLOSED', 'UNDER_EVALUATION', 'AWARDED'].includes(t.status)
              || Boolean(t.bid_due_date && new Date(`${t.bid_due_date}T23:59:59`).getTime() < Date.now());
          // Awarded state (tender port §4.4): the SELECTED bid plus its
          // contract. Amounts are ₹ Cr end to end (bid_amount and
          // contracts.contract_value are both stored in ₹ Cr).
          const selectedBid = bids.find((bid) => bid.status === 'SELECTED');
          const contract = contractsByTender.get(t.id);
          const awardedTo = selectedBid?.organizations?.name || contract?.organizations?.name || undefined;
          const awardedAmountCr = contract?.contract_value != null
            ? Number(contract.contract_value)
            : selectedBid
              ? Number(selectedBid.bid_amount) || 0
              : undefined;
          // bid_opening_date is added by a parallel DB migration; the row is
          // typed `any` here so the optional column needs no generated-type edit.
          const bidOpeningDate: string | undefined = t.bid_opening_date || undefined;
          return {
            id: t.tender_number || t.id,
            databaseId: t.id,
            title: t.title || 'Unknown',
            department: t.projects?.project_authority || 'Government Authority',
            district: t.projects?.district || 'Not specified',
            status: (t.status || 'PUBLISHED').toLowerCase() as any,
            estimatedCostCr: t.estimated_value_inr_crore == null ? 0 : Number(t.estimated_value_inr_crore),
            publishedOn: t.publication_date || '',
            submissionDeadline: t.bid_due_date || '',
            openingDate: t.bids_opened_at ? String(t.bids_opened_at).slice(0, 10) : (bidOpeningDate || ''),
            bidsReceived: counts?.submitted_bids ?? bids.filter((bid) => bid.status !== 'DRAFT' && bid.status !== 'WITHDRAWN').length,
            bidsOpened: bidOpeningAllowed,
            openingApprovals: counts?.opening_approvals ?? 0,
            minOpeningMembers: counts?.min_opening_members ?? t.min_opening_members ?? 2,
            committeeSize: counts?.committee_size ?? 0,
            isCommitteeMember: Boolean(counts?.is_committee_member),
            technicalWeight: Number(counts?.technical_weight ?? t.technical_weight ?? 0.7),
            minEvaluators: counts?.min_evaluators ?? t.min_evaluators ?? 2,
            lots: bidOpeningAllowed ? bids.filter((bid) => bid.status !== 'DRAFT' && bid.status !== 'WITHDRAWN').map((bid) => ({
              bidId: bid.id,
              bidder: bid.organizations?.name || 'Registered contractor',
              quotedAmountCr: Number(bid.bid_amount) || 0,
              technicalScore: Number(bid.technical_score) || 0,
              financialScore: Number(bid.financial_score) || 0,
              bidValidityDays: 120,
              bidStatus: bid.status === 'SELECTED' ? 'accepted' : bid.status === 'REJECTED' || bid.status === 'DISQUALIFIED' ? 'rejected' : 'under_review',
            })) : undefined,
            awardedTo,
            awardedAmountCr,
            category: t.projects?.sector || 'Infrastructure',
            mode: 'e-Tender' as const,
            projectId: t.projects?.nirikshak_project_id || t.project_id,
          };
        });
      }
      return [];
    } catch (err) {
      console.error('Error fetching tenders from Supabase:', err);
      throw err;
    }
  },
  async list(q?: ListQuery): Promise<Paginated<Tender>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
  async create(tender: {
    projectId: string;
    title: string;
    estimatedCostCr: number;
    mode?: string;
    scopeSummary?: string;
  }): Promise<Tender> {
    if (!API_BASE_URL) {
      throw new Error('Tender publication service is temporarily unavailable.');
    }

    const accessToken = await getAccessToken();

    // 60s timeout: backend cold starts (Render/Vercel) can be slow.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(`${API_BASE_URL}/api/tenders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: tender.projectId,
        title: tender.title,
        estimated_value_inr_crore: tender.estimatedCostCr,
        mode: tender.mode || 'e-Tender',
        description: tender.scopeSummary || undefined,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.data) {
      throw backendError(result, response, 'The tender could not be published.');
    }

    const data = result.data;

    // DF-40: department/district/status come from the returned row and/or
    // its joined project — never hard-coded.
    return {
      id: data.tender_number || data.id,
      databaseId: data.id,
      title: data.title,
      department: data.projects?.project_authority || data.project_authority || data.department || 'Not available',
      district: data.projects?.district || data.projects?.city || data.district || data.city || 'Not available',
      status: (String(data.status || 'PUBLISHED').toLowerCase() as Tender['status']),
      estimatedCostCr: Number(data.estimated_value_inr_crore) || tender.estimatedCostCr,
      publishedOn: data.publication_date || '',
      submissionDeadline: data.bid_due_date || '',
      openingDate: data.bid_opening_date || '',
      bidsReceived: 0,
      category: data.projects?.sector || data.sector || 'Not available',
      mode: (data.mode as any) || (tender.mode as any) || 'e-Tender',
      projectId: data.nirikshak_project_id || data.projects?.nirikshak_project_id || tender.projectId,
    };
  },

  /** Close bid submission for a published tender (tender port §4.4). */
  async close(id: string): Promise<void> {
    if (!API_BASE_URL) {
      throw new Error('Tender service is temporarily unavailable.');
    }
    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(`${API_BASE_URL}/api/tenders/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw backendError(result, response, 'The tender could not be closed.');
    }
  },

  /** Award after committee evaluation (award_contract enforces the rules). */
  async award(tenderDbId: string, bidId: string): Promise<any> {
    return backendJson('POST', `/api/tenders/${encodeURIComponent(tenderDbId)}/award`, { bid_id: bidId }, 'The contract could not be awarded.');
  },

  /** Set the evaluation committee (before bids are opened). */
  async setCommittee(tenderDbId: string, memberIds: string[], chairId?: string): Promise<void> {
    await backendJson('PUT', `/api/tenders/${encodeURIComponent(tenderDbId)}/committee`, { member_ids: memberIds, chair_id: chairId }, 'The committee could not be saved.');
  },

  /** This committee member's approval to open the bids (two-key opening). */
  async approveOpening(tenderDbId: string): Promise<{ message?: string }> {
    return backendJson('POST', `/api/tenders/${encodeURIComponent(tenderDbId)}/open`, {}, 'The bid opening could not be recorded.');
  },

  /** Active officers of the caller's organization, for the committee picker. */
  async officers(): Promise<OfficerOption[]> {
    const { data: me } = await supabase.auth.getUser();
    const { data: mine, error: mineError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', me.user?.id ?? '')
      .ilike('status', 'active')
      .maybeSingle();
    if (mineError || !mine) return [];
    const { data, error } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', (mine as any).organization_id)
      .ilike('status', 'active')
      .in('role', ['government_admin', 'chief_engineer', 'project_officer', 'government_engineer']);
    if (error) throw new Error(`Could not load officers: ${error.message}`);
    const ids = (data || []).map((r: any) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, full_name').in('id', ids)
      : { data: [] as any[] };
    const names = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    return (data || []).map((r: any) => ({ userId: r.user_id, name: names.get(r.user_id) || 'Officer', role: r.role }));
  },

  /** Record technical/financial evaluation scores for a bid (tender port §4.4). */
  async evaluateBid(
    tenderDbId: string,
    bidId: string,
    scores: { technical_score: number; financial_score: number; remarks?: string },
  ): Promise<void> {
    if (!API_BASE_URL) {
      throw new Error('Tender evaluation service is temporarily unavailable.');
    }
    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(
      `${API_BASE_URL}/api/tenders/${encodeURIComponent(tenderDbId)}/bids/${encodeURIComponent(bidId)}/evaluate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technical_score: scores.technical_score,
          financial_score: scores.financial_score,
          ...(scores.remarks ? { remarks: scores.remarks } : {}),
        }),
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeoutId));

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw backendError(result, response, 'The bid evaluation could not be saved.');
    }
  },
};

/** One submitted contractor invoice from public.contractor_invoices
 *  (migration 037), as read by financeApi.contractorInvoices(). `status`
 *  is the raw recorded status (SUBMITTED / UNDER_VERIFICATION / APPROVED /
 *  REJECTED / PAID) — drafts never reach this list. */
export interface ContractorInvoiceItem {
  id: string;
  /** The contractor's own invoice number, as they entered it. */
  invoiceNumber: string;
  contractor: string;
  milestoneLabel: string | null;
  amountInr: number;
  invoiceDate: string;
  status: string;
  notes: string | null;
  updatedAt: string;
}

/* ---------- Finance ---------- */
export const financeApi = {
  /**
   * One fund-flow row per project, aggregated from its real
   * financial_updates: allocation / budget / revised cost come from the
   * latest observation that records them, utilised is the latest recorded
   * amount_spent (a cumulative snapshot — never summed, never derived as a
   * fraction of budget). financial_updates has no released-amount or
   * demand-number column, so those stay null.
   */
  async fundFlows(): Promise<FundFlow[]> {
    const { data, error } = await supabase
      .from('financial_updates')
      .select('*, projects(project_name, nirikshak_project_id)')
      .order('observation_date', { ascending: false, nullsFirst: false });
    if (error) {
      throw new Error(`Failed to load fund flows: ${error.message}`);
    }
    const byProject = new Map<string, any[]>();
    (data || []).forEach((f: any) => {
      const rows = byProject.get(f.project_id) || [];
      rows.push(f);
      byProject.set(f.project_id, rows);
    });
    return [...byProject.entries()].map(([projectId, rows]) => {
      // Rows are newest-first: the first non-null value is the latest record.
      const latestOf = (key: string): number | null => {
        for (const r of rows) {
          if (r[key] != null && Number.isFinite(Number(r[key]))) return Number(r[key]);
        }
        return null;
      };
      const allocation = latestOf('budget_allocation_inr_crore') ?? 0;
      const budget = latestOf('original_cost_inr_crore') ?? latestOf('reported_cost_inr_crore') ?? allocation;
      const revised = latestOf('revised_cost_inr_crore') ?? budget;
      const utilized = latestOf('amount_spent_inr_crore') ?? 0;
      const latestDate: string = rows.find((r: any) => r.observation_date)?.observation_date || '';
      let fy: string | null = null;
      if (latestDate) {
        const d = new Date(latestDate);
        if (Number.isFinite(d.getTime())) {
          const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
          fy = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
        }
      }
      const projectName = rows[0]?.projects?.project_name;
      return {
        id: projectId,
        fy,
        demandNo: null,
        head: projectName ? `${projectName} — financial updates` : 'Project financial updates',
        budgetEstimateCr: budget,
        revisedEstimateCr: revised,
        allocationCr: allocation,
        releasedCr: null,
        utilizedCr: utilized,
        status: utilized > 0 ? 'released' : allocation > 0 ? 'allocated' : 'pending',
      } as FundFlow;
    });
  },
  /**
   * Bills are shaped from real financial_updates rows (there is no separate
   * bills table): each row is one recorded financial observation for the
   * project, attributed to the contractor holding the project's latest
   * contract when one exists.
   */
  async bills(): Promise<BillItem[]> {
    const [{ data, error }, { data: contractData, error: contractError }] = await Promise.all([
      supabase
        .from('financial_updates')
        .select('*, projects(project_name, nirikshak_project_id)')
        .order('observation_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('contracts')
        .select('project_id, award_date, created_at, organizations(name)')
        .is('deleted_at', null)
        .order('award_date', { ascending: false, nullsFirst: false }),
    ]);
    if (error) {
      throw new Error(`Failed to load bills: ${error.message}`);
    }
    if (contractError) console.error('Contractor lookup for bills failed:', contractError);
    const contractorByProject = new Map<string, string>();
    (contractData || []).forEach((c: any) => {
      if (c.project_id && c.organizations?.name && !contractorByProject.has(c.project_id)) {
        contractorByProject.set(c.project_id, c.organizations.name);
      }
    });
    return (data || []).map((f: any) => ({
      id: f.id,
      projectId: f.projects?.nirikshak_project_id || f.project_id,
      contractor: contractorByProject.get(f.project_id) || 'Not available',
      billNo: `FU-${String(f.id).slice(0, 8).toUpperCase()}`,
      type: 'Financial Update' as const,
      amountCr: numberOrZero(f.amount_spent_inr_crore ?? f.reported_cost_inr_crore),
      submittedOn: f.observation_date || (f.created_at || '').slice(0, 10),
      mbEntry: '—',
      status: 'submitted' as const,
    }));
  },
  /**
   * Contractor-raised invoices for one project, read from
   * public.contractor_invoices (migration 037) — kept separate from
   * bills() above because that list is shaped from financial_updates and
   * its BillItem type has no honest value for a contractor invoice.
   * Drafts are excluded: a draft has not been submitted to the department
   * yet, so it is not part of the government's bill register. Every other
   * row is returned with its real recorded status; verification, approval
   * and payment move the status on this same record.
   */
  async contractorInvoices(projectDbId: string): Promise<ContractorInvoiceItem[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('contractor_invoices' as any)
      .select('id, invoice_number, milestone_label, amount_inr, invoice_date, status, notes, updated_at, organizations(name)')
      .eq('project_id', projectDbId)
      .neq('status', 'DRAFT')
      .order('invoice_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load contractor invoices: ${error.message}`);
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number || '',
      contractor: r.organizations?.name || 'Not available',
      milestoneLabel: r.milestone_label || null,
      amountInr: numberOrZero(r.amount_inr),
      invoiceDate: r.invoice_date || '',
      status: String(r.status || '').toUpperCase(),
      notes: r.notes || null,
      updatedAt: r.updated_at || '',
    }));
  },
  /**
   * Budget heads for one project, grouped from its real financial_updates
   * rows. The group key is the head named in the row's notes (allocations
   * recorded through createAllocation carry "head — source" there); rows
   * without a named head form one "Financial updates" group. Amounts are
   * the latest recorded values per group (cumulative snapshots — never
   * summed, never derived as fractions of the sanction).
   */
  async budgetHeads(projectDbId: string): Promise<BudgetHead[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('financial_updates')
      .select('*')
      .eq('project_id', projectDbId)
      .order('observation_date', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) {
      throw new Error(`Failed to load budget heads: ${error.message}`);
    }
    const groups = new Map<string, any[]>();
    (data || []).forEach((f: any) => {
      const named = typeof f.notes === 'string' ? f.notes.split('—')[0].trim() : '';
      const key = named || 'Financial updates';
      const rows = groups.get(key) || [];
      rows.push(f);
      groups.set(key, rows);
    });
    return [...groups.entries()].map(([head, rows]) => {
      const latestOf = (keys: string[]): number | null => {
        for (let i = rows.length - 1; i >= 0; i--) {
          for (const key of keys) {
            const v = rows[i][key];
            if (v != null && Number.isFinite(Number(v))) return Number(v);
          }
        }
        return null;
      };
      const original = latestOf(['original_cost_inr_crore', 'budget_allocation_inr_crore', 'reported_cost_inr_crore']) ?? 0;
      const revised = latestOf(['revised_cost_inr_crore']);
      return {
        id: rows[0].id,
        head,
        originalCr: original,
        revisedCr: revised != null && revised !== original ? revised : undefined,
        utilizedCr: latestOf(['amount_spent_inr_crore']) ?? 0,
      };
    });
  },
  /**
   * Monthly spend series for one project: for each month with a financial
   * observation, the latest cumulative amount_spent_inr_crore recorded in
   * that month. Months without observations do not appear — no curve is
   * interpolated and no "planned" series is invented.
   */
  async monthlySpend(projectDbId: string): Promise<MonthlySpend[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('financial_updates')
      .select('observation_date, created_at, amount_spent_inr_crore')
      .eq('project_id', projectDbId)
      .order('observation_date', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) {
      throw new Error(`Failed to load monthly spend: ${error.message}`);
    }
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth = new Map<string, number>();
    (data || []).forEach((f: any) => {
      if (f.amount_spent_inr_crore == null) return;
      const stamp = f.observation_date || f.created_at;
      if (!stamp) return;
      const d = new Date(stamp);
      if (!Number.isFinite(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      // Rows arrive oldest-first, so the last write per month is the
      // latest cumulative snapshot for that month.
      byMonth.set(key, Number(f.amount_spent_inr_crore));
    });
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, cumulativeCr]) => {
        const [year, month] = key.split('-').map(Number);
        return { month: `${MONTHS[month - 1]} ${String(year).slice(2)}`, cumulativeCr };
      });
  },
  async createAllocation(projectId: string, amountCr: number, head: string, notes?: string): Promise<void> {
    // DF-07: financial_updates.project_id is a UUID column — callers must
    // pass the project's dbId, never its NIR- display id.
    if (!isUuid(projectId)) {
      throw new Error('Budget allocation requires the project database id (UUID).');
    }
    const { error } = await supabase
      .from('financial_updates')
      .insert({
        project_id: projectId,
        observation_date: new Date().toISOString().slice(0, 10),
        budget_allocation_inr_crore: amountCr,
        notes: `${head}${notes ? ` — ${notes}` : ''}`,
      });
    if (error) throw error;
  },
};

/* ---------- Audit ---------- */
export const auditApi = {
  async findings(): Promise<AuditFinding[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*, projects(project_name, nirikshak_project_id)')
      .eq('status', 'COMPLETED')
      .order('inspection_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to load audit findings: ${error.message}`);
    }
    // Findings are the completed inspections themselves, mapped 1:1 with
    // only stored fields — inspections carry no accountable-officer or
    // due-date columns, so those stay empty rather than invented.
    return (data || []).map((ins: any) => ({
      id: ins.id,
      auditTitle: ins.summary?.slice(0, 60) || ins.inspection_type || 'Inspection',
      projectId: ins.projects?.nirikshak_project_id || ins.project_id,
      severity: (ins.inspection_type === 'SAFETY_AUDIT' ? 'medium' : 'low') as any,
      category: ins.inspection_type || '',
      observation: ins.summary || '',
      raisedOn: ins.inspection_date || ins.scheduled_date || '',
      status: 'open',
      accountableOfficer: '',
      dueDate: '',
      irregularityAmountCr: 0,
    }));
  },
  /**
   * Real audit_logs activity for one project (rows whose entity_id is the
   * project's UUID — project lifecycle, tender and review actions recorded
   * by the database functions). Actor names resolve through profiles;
   * old/new values are the stored JSONB, summarised for display.
   */
  async activityForProject(projectDbId: string): Promise<ProjectActivityEntry[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_id', projectDbId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      throw new Error(`Failed to load project activity: ${error.message}`);
    }
    const rows = data || [];
    if (rows.length === 0) return [];
    const actorIds = [...new Set(rows.map((r: any) => r.actor_id).filter(Boolean))];
    const orgIds = [...new Set(rows.map((r: any) => r.actor_organization_id).filter(Boolean))];
    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      actorIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', actorIds)
        : Promise.resolve({ data: [] as any[] }),
      orgIds.length
        ? supabase.from('organizations').select('id, name').in('id', orgIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const nameByActor = new Map<string, string>();
    (profiles || []).forEach((p: any) => p?.id && nameByActor.set(p.id, p.full_name));
    const nameByOrg = new Map<string, string>();
    (orgs || []).forEach((o: any) => o?.id && nameByOrg.set(o.id, o.name));
    const summarise = (value: unknown): string => {
      if (value == null) return '—';
      if (typeof value === 'string') return value;
      const text = JSON.stringify(value);
      return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    };
    return rows.map((r: any) => ({
      id: r.id,
      timestamp: r.created_at || '',
      actor: (r.actor_id && nameByActor.get(r.actor_id)) || (r.actor_organization_id && nameByOrg.get(r.actor_organization_id)) || 'System',
      role: (r.actor_organization_id && nameByOrg.get(r.actor_organization_id)) || '',
      action: r.action || '',
      field: r.entity_type || '',
      oldValue: summarise(r.old_value),
      newValue: summarise(r.new_value),
    }));
  },
};

/* ---------- Alerts ---------- */
export const alertsApi = {
  async list(): Promise<AlertItem[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load alerts: ${error.message}`);
    }
    if (data && data.length > 0) {
      return data.map((n: any) => ({
        id: n.id,
        category: n.type || 'System',
        severity: (n.metadata?.priority === 'critical' ? 'critical' : n.metadata?.priority === 'high' ? 'high' : 'medium') as any,
        title: n.title || 'Infrastructure Alert',
        body: n.message || '',
        timestamp: n.created_at || new Date().toISOString(),
        projectId: n.entity_id,
        read: Boolean(n.read_at),
        sourceModule: 'Government Oversight & Monitoring',
      }));
    }
    return [];
  },
};

/* ---------- Documents ---------- */
/**
 * The file a document record actually points at: its external_url when
 * recorded, else its storage_path when that is itself a URL. Returns null
 * when the record carries no reachable file — callers render an honest
 * "no file attached" state instead of a fake download.
 */
export function documentFileUrl(doc: DocumentItem): string | null {
  if (doc.externalUrl) return doc.externalUrl;
  if (doc.storagePath && /^https?:\/\//i.test(doc.storagePath)) return doc.storagePath;
  return null;
}

export const documentsApi = {
  async all(): Promise<DocumentItem[]> {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*, projects(nirikshak_project_id)')
      .order('document_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to load documents: ${error.message}`);
    }
    const rows = data || [];
    if (rows.length === 0) return [];

    // Uploader names: publisher text wins; otherwise resolve the
    // uploaded_by UUID through profiles (same pattern as inspections).
    const uploaderIds = [...new Set(rows.map((d: any) => d.uploaded_by).filter(Boolean))];
    const { data: profiles } = uploaderIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', uploaderIds)
      : { data: [] as any[] };
    const nameByUploader = new Map<string, string>();
    (profiles || []).forEach((p: any) => p?.id && nameByUploader.set(p.id, p.full_name));

    return rows.map((d: any) => {
      let category: DocumentItem['category'] = 'Work Order';
      if (d.document_type === 'DPR') category = 'Administrative Approval';
      else if (d.document_type === 'EIA') category = 'Technical Approval';
      else if (d.document_type === 'CONTRACT') category = 'Contract Agreement';
      else if (d.document_type === 'INSPECTION') category = 'Inspection Report';

      return {
        id: d.id,
        name: d.title || 'Project Document',
        category,
        projectId: d.projects?.nirikshak_project_id || d.project_id,
        // Real columns only: project_documents has no size or version
        // column, so both stay null and pages render "—".
        uploadedOn: d.document_date || (d.created_at ? String(d.created_at).slice(0, 10) : null),
        uploadedBy: d.publisher || (d.uploaded_by ? nameByUploader.get(d.uploaded_by) ?? null : null),
        fileSizeKb: null,
        version: null,
        storagePath: d.storage_path ?? null,
        externalUrl: d.external_url ?? null,
        accessLevel: d.is_public ? 'Public' : 'Internal',
      };
    });
  },
  async list(q?: ListQuery): Promise<Paginated<DocumentItem>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
};

/* ---------- Litigation ---------- */
export const litigationApi = {
  async all(): Promise<LitigationCase[]> {
    // No litigation/cases table exists in the migration lineage
    // (001–036), so there is no real source to read. Returns an empty
    // list; consumers render their honest "no records" state.
    return [];
  },
};

/* ---------- Work orders & inspections ---------- */
export const workApi = {
  async workOrders(): Promise<WorkOrder[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, projects(nirikshak_project_id), organizations(name)')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load work orders: ${error.message}`);
    }
    return (data || []).map((c: any) => {
      // Completion period is derived only from the contract's own stored
      // scheduled dates; contracts carry no defect-liability or MB number.
      let completionPeriodDays: number | null = null;
      if (c.scheduled_start_date && c.scheduled_completion_date) {
        const diff = Math.round(
          (new Date(c.scheduled_completion_date).getTime() - new Date(c.scheduled_start_date).getTime()) / 86_400_000,
        );
        if (Number.isFinite(diff) && diff >= 0) completionPeriodDays = diff;
      }
      const statusRaw = String(c.status || 'ACTIVE').toUpperCase();
      return {
        id: c.contract_number || c.official_contract_id || c.id,
        projectId: c.projects?.nirikshak_project_id || c.project_id,
        contractor: c.organizations?.name ?? null,
        issuedOn: c.award_date || c.scheduled_start_date || (c.created_at || '').slice(0, 10),
        valueCr: numberOrZero(c.contract_value),
        completionPeriodDays,
        status: (statusRaw === 'ACTIVE' ? 'in_execution' : statusRaw === 'COMPLETED' ? 'closed' : 'issued') as WorkOrder['status'],
        measurementBookNo: null,
        defectLiabilityMonths: null,
      };
    });
  },
  async inspections(): Promise<InspectionRecord[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*, projects(nirikshak_project_id)')
      .order('scheduled_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to load inspections: ${error.message}`);
    }
    const rows = data || [];
    if (rows.length === 0) return [];

    // Real stored detail lives on inspection_findings (geo + evidence) and
    // profiles (inspector name). Anything absent stays null/0 — never a
    // fixed officer, fixed geo-tag or fixed photo count.
    const inspectionIds = rows.map((i: any) => i.id);
    const inspectorIds = [...new Set(rows.map((i: any) => i.inspector_id).filter(Boolean))];
    const [{ data: findings }, { data: profiles }] = await Promise.all([
      supabase
        .from('inspection_findings')
        .select('inspection_id, latitude, longitude, evidence_path, required_action')
        .in('inspection_id', inspectionIds),
      inspectorIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', inspectorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const findingsByInspection = new Map<string, any[]>();
    (findings || []).forEach((f: any) => {
      const list = findingsByInspection.get(f.inspection_id) || [];
      list.push(f);
      findingsByInspection.set(f.inspection_id, list);
    });
    const nameByInspector = new Map<string, string>();
    (profiles || []).forEach((p: any) => p?.id && nameByInspector.set(p.id, p.full_name));

    return rows.map((i: any) => {
      const own = findingsByInspection.get(i.id) || [];
      const geo = own.find((f: any) => f.latitude != null && f.longitude != null);
      const corrective = own.find((f: any) => f.required_action)?.required_action;
      return {
        id: i.id,
        projectId: i.projects?.nirikshak_project_id || i.project_id,
        inspectedOn: i.inspection_date || i.scheduled_date || '',
        inspector: i.inspector_id ? nameByInspector.get(i.inspector_id) ?? null : null,
        type: (i.inspection_type === 'SAFETY_AUDIT' ? 'Safety' : i.inspection_type === 'QUALITY_CHECK' ? 'Quality' : 'Routine') as any,
        findings: i.summary || '',
        geoTag: geo ? { lat: Number(geo.latitude), lng: Number(geo.longitude) } : null,
        photosCount: own.filter((f: any) => f.evidence_path).length,
        outcome: i.status === 'COMPLETED' ? 'satisfactory' : 'observations',
        correctiveAction: corrective || undefined,
      };
    });
  },
  /**
   * Real progress_updates for one project, with the contractor
   * organisation, milestone name, submitter name and the update's
   * progress_evidence (photo count + first recorded geo-tag). No field is
   * synthesised: an update without evidence has geoTag null and 0 photos.
   */
  async progressUpdates(projectDbId: string): Promise<SiteProgressUpdate[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('progress_updates')
      .select('*, organizations(name), project_milestones(milestone_name)')
      .eq('project_id', projectDbId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load progress updates: ${error.message}`);
    }
    const rows = data || [];
    if (rows.length === 0) return [];
    const updateIds = rows.map((u: any) => u.id);
    const submitterIds = [...new Set(rows.map((u: any) => u.submitted_by).filter(Boolean))];
    const [{ data: evidence }, { data: profiles }] = await Promise.all([
      supabase
        .from('progress_evidence')
        .select('progress_update_id, evidence_type, latitude, longitude')
        .in('progress_update_id', updateIds),
      submitterIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', submitterIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const evidenceByUpdate = new Map<string, any[]>();
    (evidence || []).forEach((e: any) => {
      const list = evidenceByUpdate.get(e.progress_update_id) || [];
      list.push(e);
      evidenceByUpdate.set(e.progress_update_id, list);
    });
    const nameBySubmitter = new Map<string, string>();
    (profiles || []).forEach((p: any) => p?.id && nameBySubmitter.set(p.id, p.full_name));
    return rows.map((u: any) => {
      const own = evidenceByUpdate.get(u.id) || [];
      const geo = own.find((e: any) => e.latitude != null && e.longitude != null);
      const statusRaw = String(u.verification_status || 'SUBMITTED').toUpperCase();
      return {
        id: u.id,
        date: (u.submitted_at || u.created_at || '').slice(0, 10),
        activity: u.description || 'Progress update',
        location: u.project_milestones?.milestone_name ?? null,
        progressPct: numberOrZero(u.reported_progress),
        verifiedProgressPct: u.verified_progress == null ? null : Number(u.verified_progress),
        contractor: u.organizations?.name ?? null,
        submittedBy: u.submitted_by ? nameBySubmitter.get(u.submitted_by) ?? null : null,
        geoTag: geo ? { lat: Number(geo.latitude), lng: Number(geo.longitude) } : null,
        photos: own.filter((e: any) => e.evidence_type === 'photo').length,
        status: (statusRaw === 'APPROVED'
          ? 'verified'
          : statusRaw === 'REJECTED'
            ? 'rejected'
            : statusRaw === 'REQUEST_CLARIFICATION'
              ? 'clarification'
              : 'pending') as SiteProgressUpdate['status'],
        verificationNote: u.review_notes || undefined,
      };
    });
  },
  /**
   * Record a progress update from the government console. The row is
   * attributed to the contractor holding the project's latest contract
   * (progress_updates.contractor_organization_id is required by the
   * schema lineage) and starts SUBMITTED, like any field submission.
   * No geo-tag or evidence is attached here — geo-tagged evidence is
   * captured by the field app. Insert errors surface to the caller.
   */
  async createProgressUpdate(
    projectDbId: string,
    input: { activity: string; location?: string; progressPct: number },
  ): Promise<void> {
    if (!isUuid(projectDbId)) {
      throw new Error('Progress updates require the project database id (UUID).');
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Your session has expired. Please sign in again.');
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('contractor_organization_id')
      .eq('project_id', projectDbId)
      .is('deleted_at', null)
      .order('award_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (contractError) throw contractError;
    if (!contract?.contractor_organization_id) {
      throw new Error('No contractor is assigned to this project yet, so a progress update cannot be recorded against it.');
    }
    const description = input.location ? `${input.activity} — ${input.location}` : input.activity;
    const { error } = await supabase.from('progress_updates').insert({
      project_id: projectDbId,
      contractor_organization_id: contract.contractor_organization_id,
      reported_progress: input.progressPct,
      description,
      submitted_by: userId,
      verification_status: 'SUBMITTED',
    });
    if (error) throw error;
  },
  /** Real project_milestones for one project, mapped 1:1 from stored fields. */
  async milestones(projectDbId: string): Promise<Milestone[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*, projects(nirikshak_project_id)')
      .eq('project_id', projectDbId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    if (error) {
      throw new Error(`Failed to load milestones: ${error.message}`);
    }
    return (data || []).map((m: any) => {
      const statusRaw = String(m.status || 'PENDING').toUpperCase();
      let delayDays: number | undefined;
      if (m.planned_end_date && m.revised_end_date) {
        const diff = Math.round(
          (new Date(m.revised_end_date).getTime() - new Date(m.planned_end_date).getTime()) / 86_400_000,
        );
        if (Number.isFinite(diff) && diff > 0) delayDays = diff;
      }
      return {
        id: m.id,
        projectId: m.projects?.nirikshak_project_id || m.project_id,
        title: m.milestone_name || '',
        status: (statusRaw === 'COMPLETED'
          ? 'completed'
          : statusRaw === 'IN_PROGRESS'
            ? 'in_progress'
            : statusRaw === 'DELAYED'
              ? 'delayed'
              : 'upcoming') as Milestone['status'],
        plannedStart: m.planned_start_date || '',
        plannedEnd: m.planned_end_date || '',
        actualStart: m.actual_start_date || undefined,
        actualEnd: m.actual_end_date || undefined,
        physicalProgressPct: numberOrZero(m.verified_progress),
        plannedProgressPct: numberOrZero(m.planned_progress),
        weightage: m.weightage == null ? null : Number(m.weightage),
        plannedCostCr: m.planned_cost == null ? null : Number(m.planned_cost),
        actualCostCr: m.actual_cost == null ? null : Number(m.actual_cost),
        delayDays,
        remarks: m.description || undefined,
      };
    });
  },
  /** Persist a verified-progress correction on a milestone row. */
  async updateMilestoneProgress(milestoneId: string, verifiedProgressPct: number): Promise<void> {
    const status = verifiedProgressPct >= 100 ? 'COMPLETED' : verifiedProgressPct > 0 ? 'IN_PROGRESS' : 'PENDING';
    const { error } = await supabase
      .from('project_milestones')
      .update({ verified_progress: verifiedProgressPct, status })
      .eq('id', milestoneId);
    if (error) throw error;
  },
};

/* ---------- AI insights ---------- */
export const insightsApi = {
  async analyzeProject(projectId: string): Promise<any> {
    if (!API_BASE_URL) throw new Error('AI analysis service is temporarily unavailable.');
    const accessToken = await getAccessToken();

    // 60s timeout: backend cold starts (Render/Vercel) can be slow.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(`${API_BASE_URL}/api/ai/analyze/${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.data?.analysis) {
      throw backendError(result, response, 'AI analysis could not be completed.');
    }
    return result.data.analysis;
  },
  async all(): Promise<AiInsight[]> {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load AI insights: ${error.message}`);
    }
    return (data || []).map(mapAiInsight);
  },
  /** Stored insights for one project (by its database UUID). */
  async byProject(projectDbId: string): Promise<AiInsight[]> {
    if (!isUuid(projectDbId)) return [];
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('project_id', projectDbId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load AI insights: ${error.message}`);
    }
    return (data || []).map(mapAiInsight);
  },
};

/**
 * Map a stored ai_insights row 1:1. Confidence is passed through exactly
 * as stored — null stays null (rendered "—"), never defaulted to 85%.
 * The insight_type is shown raw, never relabelled.
 */
function mapAiInsight(item: any): AiInsight {
  const toStrings = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
    }
    if (value == null || value === '') return [];
    return [typeof value === 'string' ? value : JSON.stringify(value)];
  };
  const evidenceItems = toStrings(item.evidence);
  const actionItems = toStrings(item.recommended_actions);
  const confidence = item.confidence == null ? null : Number(item.confidence);
  return {
    id: item.id,
    area: item.insight_type || '',
    title: item.title,
    insight: item.summary,
    supportingData: evidenceItems.join('; '),
    confidencePct: confidence == null || !Number.isFinite(confidence) ? null : Math.round(confidence * 100),
    confidenceBand:
      confidence == null || !Number.isFinite(confidence)
        ? null
        : confidence >= 0.85
          ? 'high'
          : confidence >= 0.65
            ? 'medium'
            : 'low',
    recommendedAction: actionItems.join('; '),
    relatedProjectIds: item.project_id ? [item.project_id] : [],
    generatedOn: (item.created_at || '').slice(0, 10),
    classification: 'ai_insight' as const,
    severity: item.severity || '',
    riskScore: item.risk_score == null ? null : Number(item.risk_score),
    evidenceItems,
    actionItems,
    details: item.details && typeof item.details === 'object' ? item.details : null,
  };
}

