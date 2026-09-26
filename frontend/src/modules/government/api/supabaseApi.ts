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
  const distLower = dist.toLowerCase();
  let division = 'Pune';
  if (distLower.includes('nashik') || distLower.includes('ahmednagar') || distLower.includes('dhule') || distLower.includes('jalgaon')) division = 'Nashik';
  else if (distLower.includes('nagpur') || distLower.includes('wardha') || distLower.includes('chandrapur') || distLower.includes('bhandara')) division = 'Nagpur';
  else if (distLower.includes('amravati') || distLower.includes('akola') || distLower.includes('yavatmal') || distLower.includes('buldhana')) division = 'Amravati';
  else if (distLower.includes('sambhajinagar') || distLower.includes('aurangabad') || distLower.includes('jalna') || distLower.includes('nanded') || distLower.includes('latur')) division = 'Chhatrapati Sambhajinagar';
  else if (distLower.includes('mumbai') || distLower.includes('thane') || distLower.includes('palghar') || distLower.includes('raigad')) division = 'Konkan';
  else if (distLower.includes('pune') || distLower.includes('satara') || distLower.includes('solapur') || distLower.includes('kolhapur') || distLower.includes('sangli')) division = 'Pune';
  else if (db.state) division = db.state;

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

export const projectsApi = {
  async all(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('government_project_summary_view')
      .select('*')
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
      .limit(4000);

    if (error) {
      console.error('Failed to fetch projects from Supabase:', error);
      return [];
    }

    return (data || []).map(mapDbProject);
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
      p_verified_progress: null,
      p_review_notes: notes,
    });
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
    return CONTRACTORS;
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
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('publication_date', { ascending: false });
      if (error) throw error;
      if (data) {
        return data.map((t: any) => ({
          id: t.tender_number || t.id,
          title: t.title || 'Unknown',
          department: 'Unknown',
          district: 'Unknown',
          status: (t.status || 'PUBLISHED').toLowerCase() as any,
          estimatedCostCr: t.estimated_value_inr_crore == null ? 0 : Number(t.estimated_value_inr_crore),
          publishedOn: t.publication_date || '',
          submissionDeadline: t.bid_due_date || '',
          openingDate: '',
          bidsReceived: 0,
          category: 'Unknown',
          mode: 'e-Tender' as const,
          projectId: t.project_id,
        }));
      }
    } catch (err) {
      console.error('Error fetching tenders from Supabase:', err);
      throw err;
    }
  },
  async list(q?: ListQuery): Promise<Paginated<Tender>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
};

/* ---------- Finance ---------- */
export const financeApi = {
  async fundFlows(): Promise<FundFlow[]> {
    try {
      const { data, error } = await supabase
        .from('financial_updates')
        .select('*, projects(project_name, nirikshak_project_id)')
        .order('observation_date', { ascending: false });
      if (!error && data && data.length > 0) {
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
            status: spent >= budget ? 'utilized' : (budget > 0 ? 'released' : 'allocated'),
          };
        });
      }
    } catch (err) {
      console.warn('Error fetching financial updates from Supabase:', err);
    }
    return FUND_FLOWS;
  },
  async bills(): Promise<BillItem[]> {
    return BILLS;
  },
};

/* ---------- Audit ---------- */
export const auditApi = {
  async findings(): Promise<AuditFinding[]> {
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*, projects(project_name, nirikshak_project_id)')
        .eq('status', 'COMPLETED')
        .order('inspection_date', { ascending: false });
      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Error fetching audit findings:', err);
    }
    return AUDIT_FINDINGS;
  },
};

/* ---------- Alerts ---------- */
export const alertsApi = {
  async list(): Promise<AlertItem[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Error fetching notifications from Supabase:', err);
    }
    return ALERTS;
  },
};

/* ---------- Documents ---------- */
export const documentsApi = {
  async all(): Promise<DocumentItem[]> {
    try {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .order('document_date', { ascending: false });
      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Error fetching project documents:', err);
    }
    return DOCUMENTS;
  },
  async list(q?: ListQuery): Promise<Paginated<DocumentItem>> {
    const all = await this.all();
    return paginate(matchesQuery(all, q), q);
  },
};

/* ---------- Litigation ---------- */
export const litigationApi = {
  async all(): Promise<LitigationCase[]> {
    return LITIGATION;
  },
};

/* ---------- Work orders & inspections ---------- */
export const workApi = {
  async workOrders(): Promise<WorkOrder[]> {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, projects(nirikshak_project_id)')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Error fetching contracts from Supabase:', err);
    }
    return WORK_ORDERS;
  },
  async inspections(): Promise<InspectionRecord[]> {
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*, projects(nirikshak_project_id)')
        .order('scheduled_date', { ascending: false });
      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Error fetching inspections from Supabase:', err);
    }
    return INSPECTIONS;
  },
};

/* ---------- AI insights ---------- */
export const insightsApi = {
  async all(): Promise<AiInsight[]> {
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Error fetching AI insights from Supabase:', err);
    }
    return AI_INSIGHTS;
  },
  async evaluateContractor(id: string): Promise<{
    contractorId: string;
    score: number;
    factors: { name: string; weight: number; score: number; evidence: string }[];
    strengths: string[];
    risks: string[];
    disclaimer: string;
  } | undefined> {
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

