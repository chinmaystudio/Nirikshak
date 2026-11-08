import { supabase } from '@/core/supabase/client';
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
} from '@/modules/government/types';
import { normalizeProjectStatus } from '@/core/status/projectStatus';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_USE_MOCK_API === 'true';
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
      const { error } = await supabase.from('complaints').update({ status: dbStatus }).eq('id', uuid);
      if (error) throw error;
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

  async submitGrievanceInput(): Promise<Grievance> {
    throw new Error('Use the canonical /user/report flow to submit a grievance.');
  },
};

import {
  CONTRACTORS,
  TENDERS,
  FUND_FLOWS,
  BILLS,
  AUDIT_FINDINGS,
  DOCUMENTS,
  LITIGATION,
  WORK_ORDERS,
  INSPECTIONS,
  AI_INSIGHTS,
  DEMO_OFFICER,
} from '@/data/modules';
import { ALERTS } from '@/data/alerts';

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
export const authApi = {
  async signIn(_employeeId: string, _password: string): Promise<Officer> {
    return DEMO_OFFICER;
  },
  async currentOfficer(): Promise<Officer | null> {
    return DEMO_OFFICER;
  },
};

/* ---------- Contractors ---------- */
export const contractorsApi = {
  async all(): Promise<Contractor[]> {
    return DEMO_MODE ? CONTRACTORS : [];
  },
  async list(q?: ListQuery): Promise<Paginated<Contractor>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
};

/* ---------- Tenders ---------- */
export const tendersApi = {
  async all(): Promise<Tender[]> {
    try {
      const [{ data, error }, { data: bidData, error: bidError }, { data: contractData, error: contractError }] = await Promise.all([
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
      ]);
      if (error) throw error;
      if (bidError) throw bidError;
      // The contracts read is auxiliary (award enrichment): if it is not
      // readable for this role, awarded fields still populate from the
      // SELECTED bid rather than failing the whole tender register.
      if (contractError) console.error('Contracts read for tender awards failed:', contractError);
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
          const bidOpeningAllowed = ['CLOSED', 'UNDER_EVALUATION', 'AWARDED'].includes(t.status)
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
            openingDate: bidOpeningAllowed ? (bidOpeningDate || t.bid_due_date || '') : '',
            bidsReceived: bids.filter((bid) => bid.status !== 'DRAFT' && bid.status !== 'WITHDRAWN').length,
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

  /**
   * Award a tender to the selected bid via the award_contract RPC
   * (tender port §4.4). RPC errors are user-meaningful and surfaced verbatim.
   */
  async award(tenderDbId: string, bidId: string): Promise<any> {
    const { data, error } = await supabase.rpc('award_contract', {
      p_tender_id: tenderDbId,
      p_selected_bid_id: bidId,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Record technical/financial evaluation scores for a bid (tender port §4.4). */
  async evaluateBid(
    tenderDbId: string,
    bidId: string,
    scores: { technical_score: number; financial_score: number },
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

/* ---------- Finance ---------- */
export const financeApi = {
  async fundFlows(): Promise<FundFlow[]> {
    const { data, error } = await supabase
      .from('financial_updates')
      .select('*, projects(project_name, nirikshak_project_id)')
      .order('observation_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to load fund flows: ${error.message}`);
    }
    if (data && data.length > 0) {
      return data.map((f: any, idx: number) => {
        const budget = Number(f.budget_allocation_inr_crore) || Number(f.reported_cost_inr_crore) || 100;
        const spent = Number(f.amount_spent_inr_crore) || (budget * 0.4);
        return {
          id: `FF-MH-2026-${(idx + 1).toString().padStart(4, '0')}`,
          fy: '2025-26',
          demandNo: 42,
          head: f.projects?.project_name ? `${f.projects.project_name} Execution Head` : '5054-Capital Outlay on Roads & Bridges',
          budgetEstimateCr: budget,
          revisedEstimateCr: Number(f.revised_cost_inr_crore) || budget,
          allocationCr: budget,
          releasedCr: budget * 0.8,
          utilizedCr: spent,
          status: budget > 0 ? 'released' : 'allocated',
        };
      });
    }
    return DEMO_MODE ? FUND_FLOWS : [];
  },
  async bills(): Promise<BillItem[]> {
    return DEMO_MODE ? BILLS : [];
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
    if (data && data.length > 0) {
      return data.map((ins: any, idx: number) => ({
        id: `AUD-2026-${(idx + 1).toString().padStart(4, '0')}`,
        auditTitle: ins.summary?.slice(0, 60) || 'Field Quality & Safety Audit',
        projectId: ins.projects?.nirikshak_project_id || ins.project_id,
        severity: (ins.inspection_type === 'SAFETY_AUDIT' ? 'medium' : 'low') as any,
        category: ins.inspection_type || 'Civil Quality Check',
        observation: ins.summary || 'Periodic compliance audit conducted at project site.',
        raisedOn: ins.inspection_date || '2026-03-01',
        status: 'open',
        accountableOfficer: 'Chief Quality Inspector (Pune Div)',
        dueDate: '2026-04-15',
        irregularityAmountCr: 0,
      }));
    }
    return DEMO_MODE ? AUDIT_FINDINGS : [];
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
    return DEMO_MODE ? ALERTS : [];
  },
};

/* ---------- Documents ---------- */
export const documentsApi = {
  async all(): Promise<DocumentItem[]> {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .order('document_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to load documents: ${error.message}`);
    }
    if (data && data.length > 0) {
      return data.map((d: any) => {
        let category: DocumentItem['category'] = 'Work Order';
        if (d.document_type === 'DPR') category = 'Administrative Approval';
        else if (d.document_type === 'EIA') category = 'Technical Approval';
        else if (d.document_type === 'CONTRACT') category = 'Contract Agreement';
        else if (d.document_type === 'INSPECTION') category = 'Inspection Report';

        return {
          id: d.id,
          name: d.title || 'Project Document',
          category,
          projectId: d.project_id,
          uploadedOn: d.document_date || '2025-01-01',
          uploadedBy: d.publisher || 'Department Engineer',
          fileSizeKb: 2450,
          version: 1,
          accessLevel: d.is_public ? 'Public' : 'Internal',
        };
      });
    }
    return DEMO_MODE ? DOCUMENTS : [];
  },
  async list(q?: ListQuery): Promise<Paginated<DocumentItem>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
};

/* ---------- Litigation ---------- */
export const litigationApi = {
  async all(): Promise<LitigationCase[]> {
    return DEMO_MODE ? LITIGATION : [];
  },
};

/* ---------- Work orders & inspections ---------- */
export const workApi = {
  async workOrders(): Promise<WorkOrder[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, projects(nirikshak_project_id)')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load work orders: ${error.message}`);
    }
    if (data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.contract_number || c.official_contract_id || c.id,
        projectId: c.projects?.nirikshak_project_id || c.project_id,
        contractor: 'L&T - Tata Projects Consortium',
        issuedOn: c.scheduled_start_date || '2023-01-15',
        valueCr: Number(c.contract_value) || 2450,
        completionPeriodDays: 1095,
        status: (c.status || 'ACTIVE').toLowerCase() === 'active' ? 'in_execution' : 'issued',
        measurementBookNo: `eMB-2026-${(c.contract_number || '01').slice(-3)}`,
        defectLiabilityMonths: 36,
      }));
    }
    return DEMO_MODE ? WORK_ORDERS : [];
  },
  async inspections(): Promise<InspectionRecord[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*, projects(nirikshak_project_id)')
      .order('scheduled_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to load inspections: ${error.message}`);
    }
    if (data && data.length > 0) {
      return data.map((i: any) => ({
        id: i.id,
        projectId: i.projects?.nirikshak_project_id || i.project_id,
        inspectedOn: i.inspection_date || i.scheduled_date || '2026-03-01',
        inspector: 'Er. R. K. Shinde (SE Pune)',
        type: (i.inspection_type === 'SAFETY_AUDIT' ? 'Safety' : i.inspection_type === 'QUALITY_CHECK' ? 'Quality' : 'Routine') as any,
        findings: i.summary || 'Site inspection completed as per protocol.',
        geoTag: { lat: 18.5204, lng: 73.8567 },
        photosCount: 4,
        outcome: i.status === 'COMPLETED' ? 'satisfactory' : 'observations',
        correctiveAction: i.status !== 'COMPLETED' ? 'Action item assigned to contractor' : undefined,
      }));
    }
    return DEMO_MODE ? INSPECTIONS : [];
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
    if (data && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        area: item.insight_type === 'schedule_risk' ? 'Schedule & Delay Prediction' : item.insight_type === 'complaint_cluster' ? 'Public Grievance Correlation' : 'Cost & Material Anomaly',
        title: item.title,
        insight: item.summary,
        supportingData: Array.isArray(item.evidence) ? item.evidence.join('; ') : (item.evidence || ''),
        confidencePct: Math.round((Number(item.confidence) || 0.85) * 100),
        confidenceBand: (Number(item.confidence) >= 0.85 ? 'high' : Number(item.confidence) >= 0.65 ? 'medium' : 'low') as any,
        recommendedAction: Array.isArray(item.recommended_actions) ? item.recommended_actions.join('; ') : (item.recommended_actions || ''),
        relatedProjectIds: item.project_id ? [item.project_id] : [],
        generatedOn: (item.created_at || '').slice(0, 10) || '2026-02-20',
        classification: 'ai_insight' as const,
      }));
    }
    return DEMO_MODE ? AI_INSIGHTS : [];
  },
  async evaluateContractor(id: string): Promise<{
    contractorId: string;
    score: number;
    factors: { name: string; weight: number; score: number; evidence: string }[];
    strengths: string[];
    risks: string[];
    disclaimer: string;
  } | undefined> {
    if (!DEMO_MODE) return undefined;
    const c = CONTRACTORS.find((x) => x.id === id);
    if (!c) return undefined;
    return {
      contractorId: id,
      score: c.aiScore,
      factors: [
        { name: 'On-time completion', weight: 20, score: Math.round(c.onTimeCompletionPct * 0.9), evidence: `${c.onTimeCompletionPct}% of milestones met across last 3 years.` },
        { name: 'Quality (NABL test pass rate)', weight: 18, score: Math.round(c.qualityRating * 20), evidence: `Quality rating ${c.qualityRating.toFixed(1)}/5 from ${c.completedProjects} completed works.` },
        { name: 'Pending defect liability', weight: 12, score: Math.max(0, 100 - c.pendingDefects * 12), evidence: `${c.pendingDefects} open defects across DL period.` },
        { name: 'Litigation exposure', weight: 12, score: Math.max(0, 100 - c.litigationCount * 30), evidence: `${c.litigationCount} active case(s).` },
        { name: 'Financial turnover trend', weight: 10, score: 78, evidence: 'Turnover consistent with Class registration.' },
        { name: 'Plant & machinery availability', weight: 8, score: 82, evidence: 'Regional plant census, last quarter.' },
        { name: 'Safety record', weight: 8, score: 88, evidence: 'No fatal incidents; minor LTI rate 0.9 per lakh man-hours.' },
        { name: 'Manpower & key personnel', weight: 6, score: 74, evidence: 'Site-engineer ratio 1:2.3 (norm 1:3.0).' },
        { name: 'Past e-MB accuracy', weight: 6, score: 81, evidence: 'Measurement variance within ±2% on test check.' },
      ],
      strengths: c.strengths,
      risks: c.risks,
      disclaimer: 'AI-assisted evaluation. Final decision remains with the authorized officer.',
    };
  },
};

