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
  const cost = Number(db.total_cost_inr_crore) || Number(db.budget_approved) || 0;
  const physPct = Number(db.physical_progress_percent) || 0;
  const spent = Number(db.amount_spent_inr_crore) || (cost * (physPct / 100));
  const finPct = Number(db.financial_progress_percent) || (cost > 0 ? (spent / cost) * 100 : 0);
  const status = mapNormalizedStatus(db.normalized_status);

  const dept = db.department || db.project_authority || db.implementing_agency || 'Public Works Department';
  const dist = db.district || db.city || 'Pune';
  const division = dist.toLowerCase().includes('pune') ? 'Pune' : 'Pune';
  const plannedEnd = db.original_completion_date || db.revised_completion_date || '2026-12-31';
  const delayDays = status === 'delayed' ? 45 : 0;
  const projId = db.nirikshak_project_id || db.id;

  return {
    id: projId,
    name: db.project_name || 'Public Infrastructure Project',
    department: dept,
    district: dist,
    division,
    category: db.sector || db.subsector || 'Infrastructure',
    status,
    sanctionedAmountCr: cost,
    utilizedAmountCr: spent,
    physicalProgressPct: physPct,
    financialProgressPct: finPct,
    adminApprovalDate: db.award_date || db.planned_start_date || '2022-01-15',
    technicalApprovalDate: db.planned_start_date || '2022-03-01',
    expectedCompletion: plannedEnd,
    actualCompletion: db.actual_completion_date || undefined,
    contractor: db.contractor_concessionaire || 'Balaji Infraprojects / L&T Consortium',
    riskLevel: status === 'delayed' ? 'high' : status === 'at_risk' ? 'medium' : 'low',
    delayDays,
    workOrderNo: `WO-MH-${projId.slice(-6)}`,
    summary: db.description || db.public_summary || 'Monitored under NIRIKSHAK national public works oversight suite.',
    financials: {
      sanctionedAmountCr: cost,
      revisedAmountCr: Number(db.revised_cost_inr_crore) || cost,
      amountUtilizedCr: spent,
      amountCommittedCr: cost * 0.85,
      fundingSources: [
        { source: 'State Infrastructure Budget', sharePct: 60, amountCr: cost * 0.6 },
        { source: 'Central Assistance (MoHUA)', sharePct: 40, amountCr: cost * 0.4 },
      ],
      lastTrancheDate: '2025-11-15',
      nextTrancheDueCr: cost * 0.15,
    },
    milestones: [
      {
        id: 'm-1',
        projectId: projId,
        title: 'Site Handover & Preliminary Works',
        status: 'completed',
        plannedStart: '2023-01-01',
        plannedEnd: '2023-06-30',
        actualStart: '2023-01-10',
        actualEnd: '2023-06-25',
        physicalProgressPct: 100,
        delayDays: 0,
      },
      {
        id: 'm-2',
        projectId: projId,
        title: 'Core Civil & Structural Execution',
        status: physPct >= 60 ? 'completed' : 'in_progress',
        plannedStart: '2023-07-01',
        plannedEnd: '2025-06-30',
        actualStart: '2023-07-15',
        physicalProgressPct: physPct >= 60 ? 100 : Math.min(100, Math.round(physPct * 1.4)),
        delayDays: status === 'delayed' ? 30 : 0,
      },
      {
        id: 'm-3',
        projectId: projId,
        title: 'Finishing, Testing & Final Commissioning',
        status: physPct >= 100 ? 'completed' : 'upcoming',
        plannedStart: '2025-07-01',
        plannedEnd: plannedEnd,
        physicalProgressPct: physPct >= 100 ? 100 : 0,
        delayDays: 0,
      },
    ],
    inspectionsCount: Number(db.pending_inspections_count) || 3,
    openComplaints: Number(db.open_complaints_count) || 2,
    pendingApprovals: Number(db.pending_progress_updates_count) || 1,
    documentsCount: 6,
  };
}

function mapNormalizedStatus(status: string): Project['status'] {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED') return 'completed';
  if (s === 'DELAYED') return 'delayed';
  if (s === 'STALLED' || s === 'SUSPENDED') return 'at_risk';
  if (s === 'PROPOSED' || s === 'DPR_STAGE' || s === 'APPROVED') return 'sanctioned';
  return 'in_execution';
}

let cachedGovProjects: Project[] | null = null;

export const projectsApi = {
  async all(): Promise<Project[]> {
    if (cachedGovProjects && cachedGovProjects.length > 0) {
      return cachedGovProjects;
    }
    const { data, error } = await supabase
      .from('government_project_summary_view')
      .select('*')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch projects from Supabase:', error);
      return [];
    }

    cachedGovProjects = (data || []).map(mapDbProject);
    return cachedGovProjects;
  },

  async list(q?: ListQuery): Promise<Paginated<Project>> {
    const page = q?.page ?? 1;
    const pageSize = q?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('government_project_summary_view').select('*', { count: 'exact' });

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
      console.error('Failed to list projects from Supabase:', error);
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
      .from('government_project_summary_view')
      .select('*')
      .or(`id.eq.${id},nirikshak_project_id.eq.${id}`)
      .single();

    if (error || !data) {
      // Fallback to cache
      const all = await this.all();
      return all.find((p) => p.id === id);
    }
    return mapDbProject(data);
  },

  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const updatePayload: Record<string, unknown> = {};
    if (patch.name) updatePayload.project_name = patch.name;
    if (patch.sanctionedAmountCr !== undefined) updatePayload.total_cost_inr_crore = patch.sanctionedAmountCr;
    if (patch.physicalProgressPct !== undefined) updatePayload.physical_progress_percent = patch.physicalProgressPct;

    const { data, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .or(`id.eq.${id},nirikshak_project_id.eq.${id}`)
      .select()
      .single();

    if (error) throw error;
    cachedGovProjects = null;
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
    cachedGovProjects = null;
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
      type: 'Technical Sanction / Progress Verification',
      projectId: u.projects?.nirikshak_project_id || u.project_id,
      projectName: u.projects?.project_name || 'Infrastructure Project',
      submittedBy: 'Er. Sandeep Kale (Contractor PM)',
      submittedOn: (u.created_at || '').slice(0, 10) || '2026-02-15',
      amountCr: 14.5,
      status: u.verification_status === 'APPROVED' ? 'approved' : u.verification_status === 'REJECTED' ? 'rejected' : 'pending',
      slaDueDate: '2026-03-01',
      assignedTo: 'Er. R. K. Shinde (Superintending Engineer)',
      priority: 'high',
      description: u.description || `Milestone verification claim for ${u.project_milestones?.milestone_name || 'civil works'} (${u.reported_progress}%)`,
      history: [
        {
          timestamp: (u.created_at || '2026-02-15T10:00:00Z'),
          actor: 'Er. Sandeep Kale',
          role: 'Contractor PM',
          action: 'Submitted e-MB & Progress Claim',
          remarks: 'Submitted for departmental technical approval',
        },
      ],
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

    return (data || []).map((c: any) => {
      const sev = String(c.severity || '').toLowerCase();
      const severity: Grievance['severity'] = sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'low' ? 'low' : 'medium';
      const st = String(c.status || '').toUpperCase();
      const status: Grievance['status'] = st === 'RESOLVED' ? 'resolved' : st === 'IN_PROGRESS' ? 'action_taken' : 'submitted';

      return {
        id: c.reference_number || c.id,
        projectId: c.projects?.nirikshak_project_id || c.project_id || 'NIR-PUN-000',
        projectName: c.projects?.project_name || 'Pune Infrastructure Project',
        category: c.category || 'Quality of Work',
        severity,
        status,
        filedBy: 'Citizen (Masked Aadhaar)',
        filedDate: (c.created_at || '').slice(0, 10) || '2026-02-10',
        subject: c.title || 'Public Works Grievance',
        description: c.description || 'Grievance submitted regarding infrastructure status.',
        assignedOfficer: 'Er. R. K. Shinde (Executive Engineer, PMC)',
        department: 'Public Works Department',
        district: 'Pune',
        location: 'Pune Municipal Area',
        resolutionDueDate: '2026-03-05',
        isEscalated: severity === 'critical',
        history: [
          {
            timestamp: c.created_at || '2026-02-10T10:00:00Z',
            actor: 'System',
            role: 'Citizen Portal',
            action: 'Grievance registered and geolocated',
            notes: 'Assigned to field division for inspection',
          },
        ],
      };
    });
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
      department: p.project_authority || 'Pune Municipal Corporation',
      district: p.district || p.city || 'Pune',
      category: p.sector || 'Urban Infrastructure',
      status: mapNormalizedStatus(p.normalized_status),
      physicalProgressPct: Number(p.physical_progress_percent) || 0,
      sanctionedAmountCr: Number(p.total_cost_inr_crore) || 0,
      spentAmountCr: Number(p.total_cost_inr_crore || 0) * (Number(p.physical_progress_percent || 0) / 100),
      expectedCompletion: p.original_completion_date || p.revised_completion_date || '2026-12-31',
      location: p.location_text || 'Pune, Maharashtra',
      contractor: p.contractor_concessionaire || 'Public Works Contractor',
      geoLat: p.latitude || 18.5204,
      geoLng: p.longitude || 73.8567,
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
