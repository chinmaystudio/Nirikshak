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

// Helper to map DB project to Government Portal Project type
function mapDbProject(db: any): Project {
  return {
    id: db.nirikshak_project_id || db.id,
    name: db.project_name || 'Untitled Project',
    nameHi: db.project_name || 'Untitled Project',
    nameMr: db.project_name || 'Untitled Project',
    code: db.nirikshak_project_id || 'NIR-PUN-000',
    departmentId: 'dept-pmc-roads',
    departmentName: db.project_authority || 'Pune Municipal Corporation',
    status: mapNormalizedStatus(db.normalized_status),
    budgetCrore: Number(db.total_cost_inr_crore) || 0,
    revisedBudgetCrore: Number(db.revised_cost_inr_crore) || Number(db.total_cost_inr_crore) || 0,
    spentCrore: Number(db.amount_spent_inr_crore) || (Number(db.total_cost_inr_crore || 0) * (Number(db.physical_progress_percent || 0) / 100)),
    startDate: db.award_date || db.planned_start_date || '2022-01-01',
    targetDate: db.original_completion_date || db.revised_completion_date || '2026-12-31',
    physicalProgressPercent: Number(db.physical_progress_percent) || 0,
    financialProgressPercent: Number(db.financial_progress_percent) || Number(db.physical_progress_percent) || 0,
    executiveSummary: db.description || db.public_summary || 'Authoritative infrastructure project tracked under NIRIKSHAK national audit suite.',
    location: {
      address: db.location_text || 'Pune, Maharashtra',
      ward: 'Central Ward',
      constituency: 'Pune Central',
      lat: db.latitude || 18.5204,
      lng: db.longitude || 73.8567,
    },
    primaryContractor: {
      id: 'con-tata',
      name: db.contractor_concessionaire || 'Tata Projects / Infrastructure EPC',
    },
    milestones: [
      {
        id: 'm-1',
        title: 'Foundation & Preliminary Earthworks',
        plannedDate: '2023-06-30',
        actualDate: '2023-06-25',
        status: 'completed',
        weightagePercent: 30,
        amountCrore: (Number(db.total_cost_inr_crore) || 100) * 0.3,
      },
      {
        id: 'm-2',
        title: 'Superstructure & Civil Viaduct',
        plannedDate: '2025-03-31',
        status: db.physical_progress_percent >= 60 ? 'completed' : 'in_progress',
        weightagePercent: 40,
        amountCrore: (Number(db.total_cost_inr_crore) || 100) * 0.4,
      },
      {
        id: 'm-3',
        title: 'MEP, Signalling & Final Commissioning',
        plannedDate: '2026-12-31',
        status: db.physical_progress_percent >= 100 ? 'completed' : 'upcoming',
        weightagePercent: 30,
        amountCrore: (Number(db.total_cost_inr_crore) || 100) * 0.3,
      },
    ],
    risks: [],
  };
}

function mapNormalizedStatus(status: string): Project['status'] {
  const s = String(status).toUpperCase();
  if (s === 'COMPLETED') return 'completed';
  if (s === 'DELAYED') return 'delayed';
  if (s === 'STALLED' || s === 'SUSPENDED') return 'at_risk';
  if (s === 'PROPOSED' || s === 'DPR_STAGE' || s === 'APPROVED') return 'sanctioned';
  return 'in_execution';
}

export const projectsApi = {
  async all(q?: ListQuery): Promise<Paginated<Project>> {
    const page = q?.page ?? 1;
    const pageSize = q?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('projects').select('*', { count: 'exact' });

    if (q?.search) {
      query = query.or(`project_name.ilike.%${q.search}%,location_text.ilike.%${q.search}%,nirikshak_project_id.ilike.%${q.search}%`);
    }

    if (q?.status) {
      query = query.ilike('normalized_status', `%${q.status}%`);
    }

    const { data, count, error } = await query
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error('Failed to fetch projects from Supabase:', error);
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const items = (data || []).map(mapDbProject);
    const total = count || items.length;
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async get(id: string): Promise<Project | undefined> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_milestones(*), contracts(*)')
      .or(`id.eq.${id},nirikshak_project_id.eq.${id}`)
      .single();

    if (error || !data) return undefined;
    return mapDbProject(data);
  },

  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const updatePayload: Record<string, unknown> = {};
    if (patch.name) updatePayload.project_name = patch.name;
    if (patch.budgetCrore) updatePayload.total_cost_inr_crore = patch.budgetCrore;
    if (patch.physicalProgressPercent !== undefined) updatePayload.physical_progress_percent = patch.physicalProgressPercent;

    const { data, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .or(`id.eq.${id},nirikshak_project_id.eq.${id}`)
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
        sector: 'Urban Infrastructure',
        project_authority: p.departmentName || 'Pune Municipal Corporation',
        total_cost_inr_crore: p.budgetCrore,
        physical_progress_percent: p.physicalProgressPercent,
        location_text: p.location.address,
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
    const { data } = await supabase
      .from('progress_updates')
      .select('*, projects(project_name, nirikshak_project_id), project_milestones(milestone_name)')
      .order('created_at', { ascending: false });

    return (data || []).map((u: any) => ({
      id: u.id,
      projectId: u.projects?.nirikshak_project_id || u.project_id,
      projectName: u.projects?.project_name || 'Infrastructure Project',
      type: 'progress_claim',
      title: `${u.project_milestones?.milestone_name || 'Milestone'} Progress Claim (${u.reported_progress}%)`,
      submittedBy: 'Contractor Project Manager',
      submittedDate: (u.created_at || '').slice(0, 10),
      amountCrore: 14.5,
      status: u.verification_status === 'APPROVED' ? 'approved' : u.verification_status === 'REJECTED' ? 'rejected' : 'pending',
      slaDueDays: 3,
      slaBreached: false,
      recommendedAction: 'Approve after on-site photographic and batching verification',
      riskScore: 24,
      riskTone: 'success',
      description: u.description || 'Contractor progress claim submission',
      auditHistory: [],
    }));
  },

  async pending(): Promise<ApprovalItem[]> {
    const all = await this.all();
    return all.filter((a) => a.status === 'pending');
  },

  async approve(id: string, notes = 'Approved after verification.'): Promise<void> {
    await supabase.rpc('approve_progress_update', {
      p_update_id: id,
      p_decision: 'APPROVED',
      p_verified_progress: 95.0,
      p_review_notes: notes,
      p_reviewer_id: '11111111-1111-1111-1111-111111111111',
    });
  },

  async reject(id: string, notes = 'Rejected.'): Promise<void> {
    await supabase.from('progress_updates').update({
      verification_status: 'REJECTED',
      review_notes: notes,
    }).eq('id', id);
  },
};

export const grievancesApi = {
  async all(): Promise<Grievance[]> {
    const { data } = await supabase
      .from('complaints')
      .select('*, projects(project_name, nirikshak_project_id)')
      .order('created_at', { ascending: false });

    return (data || []).map((c: any) => ({
      id: c.reference_number || c.id,
      projectId: c.projects?.nirikshak_project_id || c.project_id,
      projectName: c.projects?.project_name || 'Infrastructure Project',
      subject: c.title,
      description: c.description,
      submittedBy: 'Citizen (Masked)',
      submittedDate: (c.created_at || '').slice(0, 10),
      status: c.status === 'RESOLVED' ? 'resolved' : c.status === 'IN_PROGRESS' ? 'action_taken' : 'submitted',
      priority: c.severity === 'CRITICAL' ? 'critical' : c.severity === 'HIGH' ? 'high' : 'medium',
      slaDaysRemaining: 5,
      slaBreached: false,
      category: c.category,
      departmentId: 'dept-pmc-roads',
      assignedOfficer: 'Er. R. K. Shinde (Executive Engineer)',
      location: 'Pune Municipal Area',
      publicVisibility: true,
      timeline: [],
    }));
  },

  async get(id: string): Promise<Grievance | undefined> {
    const all = await this.all();
    return all.find((g) => g.id === id);
  },

  async update(id: string, patch: Partial<Grievance>): Promise<Grievance> {
    if (patch.status) {
      const dbStatus = patch.status === 'resolved' ? 'RESOLVED' : patch.status === 'action_taken' ? 'IN_PROGRESS' : 'SUBMITTED';
      await supabase.from('complaints').update({ status: dbStatus }).or(`id.eq.${id},reference_number.eq.${id}`);
    }
    const found = await this.get(id);
    return found!;
  },
};

export const citizenApi = {
  async all(): Promise<CitizenProjectSummary[]> {
    const { data } = await supabase
      .from('public_projects_view')
      .select('*')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false });

    return (data || []).map((p: any) => ({
      id: p.nirikshak_project_id || p.id,
      name: p.project_name,
      nameHi: p.project_name,
      nameMr: p.project_name,
      department: p.project_authority || 'Pune Municipal Corporation',
      status: mapNormalizedStatus(p.normalized_status),
      physicalProgressPercent: Number(p.physical_progress_percent) || 0,
      spentCrore: Number(p.total_cost_inr_crore) || 0,
      expectedCompletion: p.original_completion_date || p.revised_completion_date || '2026-12-31',
      contractor: p.contractor_concessionaire || 'Public Works Contractor',
      ward: 'Pune Metropolitan Region',
      location: p.location_text || 'Pune, Maharashtra',
      lat: p.latitude || 18.5204,
      lng: p.longitude || 73.8567,
    }));
  },

  async get(id: string): Promise<CitizenProjectSummary | undefined> {
    const all = await this.all();
    return all.find((p) => p.id === id);
  },

  async trackGrievance(ref: string): Promise<Grievance | undefined> {
    return grievancesApi.get(ref);
  },
};

// Re-export mock fallbacks for secondary mock endpoints to ensure 100% UI stability
export {
  authApi,
  contractorsApi,
  tendersApi,
  financeApi,
  auditApi,
  alertsApi,
  documentsApi,
  litigationApi,
  workApi,
  insightsApi,
} from './mockApi';
