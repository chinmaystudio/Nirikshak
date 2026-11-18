import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToastItem } from '../components/ui';
import type {
  Notification, Worker, ResourceRow, Invoice, ProgressReport, Message,
  ProjectDoc, Bid, Project, FinancialUpdate, ContractorOrganization, NotifCategory,
} from './types';
import { uid } from './utils';
import { scheduleElapsedPercent } from './health';
import { normalizeProjectStatus } from '@/core/status/projectStatus';
import { useAuth } from '@/core/auth/useAuth';

// ─── Data provenance (production invariant: zero fabricated data) ───────────
// • Identity: the real organizations row behind the signed-in user's active
//   organization_members membership (exposed as `contractorOrganization`).
// • Projects: contractor_assigned_projects_view + contracts (dates),
//   project_milestones, inspections, complaints (open counts assigned to the
//   org) — all loaded below from Supabase.
// • Documents: public.project_documents (list + metadata insert; the insert
//   throws on RLS/DB failure so the UI never reports a save that did not happen).
// • Department finance: public.financial_updates (read-only list).
// • Notifications: public.notifications for the signed-in user.
// • Workers, resources, messages and contractor invoices: the migration-037
//   tables public.project_workers / project_resources / project_messages /
//   contractor_invoices. Every create/edit/delete below writes through to
//   those tables and only updates local state after the database confirms;
//   failures throw so the UI surfaces the real error. The 037 tables are
//   not yet in the generated Database types, so they are accessed through
//   `from('<table>' as any)` (the same pattern the citizen portal uses for
//   views missing from the generated types).

interface A11y {
  hc: boolean;
  rm: boolean;
  ul: boolean;
}

interface Store {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  fontScale: number;
  stepFont: (dir: 1 | -1) => void;
  a11y: A11y;
  toggleA11y: (k: keyof A11y) => void;
  lang: string;
  setLang: (l: string) => void;

  toasts: ToastItem[];
  toast: (type: ToastItem['type'], title: string, msg?: string) => void;
  dismissToast: (id: number) => void;

  /** The signed-in contractor's real organization, or null when not linked. */
  contractorOrganization: ContractorOrganization | null;

  notifications: Notification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;

  projects: Project[];
  reports: ProgressReport[];
  // With { submitToGovernment: true } the report is submitted through the
  // backend (POST /api/progress/submit, evidence included) BEFORE it is
  // recorded locally; the returned promise rejects on any failure so callers
  // can block their success UI. Without the flag it only records a local draft.
  addReport: (r: Omit<ProgressReport, 'id' | 'submittedAt'>, opts?: { submitToGovernment?: boolean }) => Promise<string>;
  setReportStatus: (id: string, status: ProgressReport['status'], note?: string) => void;

  // Migration-037 tables — all writes are async and reject on DB failure.
  workers: Record<string, Worker[]>;
  addWorker: (projectId: string, w: Omit<Worker, 'id'>) => Promise<void>;
  updateWorker: (projectId: string, w: Worker) => Promise<void>;
  removeWorker: (projectId: string, id: string) => Promise<void>;

  resources: Record<string, ResourceRow[]>;
  addResource: (projectId: string, r: Omit<ResourceRow, 'id'>) => Promise<void>;
  updateResource: (projectId: string, r: ResourceRow) => Promise<void>;
  removeResource: (projectId: string, id: string) => Promise<void>;

  invoices: Invoice[];
  addInvoice: (i: Omit<Invoice, 'id' | 'updatedAt'>) => Promise<void>;
  submitInvoice: (id: string) => Promise<void>;
  updateInvoiceNote: (id: string, note: string) => Promise<void>;
  removeInvoice: (id: string) => Promise<void>;

  messages: Record<string, Message[]>;
  sendMessage: (m: { projectId: string; subject: string; body: string }) => Promise<void>;

  documents: Record<string, ProjectDoc[]>;
  addDocument: (projectId: string, d: Omit<ProjectDoc, 'id' | 'uploaded' | 'by'>) => Promise<void>;

  financialUpdates: FinancialUpdate[];

  bids: Record<string, Bid>;
  saveBidDraft: (tenderId: string, step: number, data: Record<string, unknown>) => void;
  // bidReference MUST be the server-issued reference (NIR-BID-…) returned by
  // ContractorTenderService.submitBid — the store never invents one.
  submitBid: (tenderId: string, bidValue: number, bidReference: string) => string;

  savedTenders: string[];
  toggleSaveTender: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

function categoryForNotificationType(type: string): NotifCategory {
  const t = (type || '').toLowerCase();
  if (t.includes('tender') || t.includes('bid')) return 'Tender';
  if (t.includes('inspect')) return 'Inspection';
  if (t.includes('financ') || t.includes('payment') || t.includes('bill')) return 'Finance';
  if (t.includes('complian')) return 'Compliance';
  if (t.includes('project') || t.includes('progress') || t.includes('milestone')) return 'Project';
  return 'Government';
}

// ─── Migration-037 row mapping (DB enums ⇄ portal labels) ───────────────────
const WORKER_STATUS_TO_UI: Record<string, Worker['status']> = { ACTIVE: 'Active', ON_LEAVE: 'On Leave', TRANSFERRED: 'Transferred' };
const WORKER_STATUS_TO_DB: Record<Worker['status'], string> = { Active: 'ACTIVE', 'On Leave': 'ON_LEAVE', Transferred: 'TRANSFERRED' };
const RESOURCE_STATUS_TO_UI: Record<string, ResourceRow['status']> = { AVAILABLE: 'Available', IN_USE: 'In Use', LOW_STOCK: 'Low Stock', IDLE: 'Idle' };
const RESOURCE_STATUS_TO_DB: Record<ResourceRow['status'], string> = { Available: 'AVAILABLE', 'In Use': 'IN_USE', 'Low Stock': 'LOW_STOCK', Idle: 'IDLE' };
const INVOICE_STATUS_TO_UI: Record<string, Invoice['status']> = { DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_VERIFICATION: 'Under Verification', APPROVED: 'Approved', REJECTED: 'Rejected', PAID: 'Paid' };
const MESSAGE_STATUS_TO_UI: Record<string, Message['status']> = { SENT: 'Sent', READ: 'Read', ACTION_REQUIRED: 'Action Required', RESPONDED: 'Responded' };

function mapWorkerRow(r: any): Worker {
  return {
    id: r.id,
    name: r.full_name || '',
    role: r.role || '',
    category: (['Skilled', 'Unskilled', 'Supervisor'].includes(r.category) ? r.category : 'Skilled') as Worker['category'],
    area: r.work_area || '',
    attendance: r.attendance_percent != null ? Number(r.attendance_percent) : null,
    hours: r.hours != null ? Number(r.hours) : null,
    status: WORKER_STATUS_TO_UI[String(r.status || '').toUpperCase()] ?? 'Active',
  };
}

function mapResourceRow(r: any): ResourceRow {
  return {
    id: r.id,
    name: r.name || '',
    category: (['Machinery', 'Equipment', 'Vehicles', 'Materials'].includes(r.category) ? r.category : 'Equipment') as ResourceRow['category'],
    qty: r.quantity != null ? Number(r.quantity) : 0,
    allocated: r.allocated != null ? Number(r.allocated) : 0,
    used: r.used != null ? Number(r.used) : 0,
    unit: r.unit || 'units',
    status: RESOURCE_STATUS_TO_UI[String(r.status || '').toUpperCase()] ?? 'Available',
  };
}

function mapInvoiceRow(r: any): Invoice {
  return {
    id: r.id,
    no: r.invoice_number || '',
    projectId: r.project_id,
    milestone: r.milestone_label || '',
    amount: r.amount_inr != null ? Number(r.amount_inr) : 0,
    date: r.invoice_date || (r.created_at ? String(r.created_at).slice(0, 10) : ''),
    status: INVOICE_STATUS_TO_UI[String(r.status || '').toUpperCase()] ?? 'Draft',
    note: r.notes || undefined,
    updatedAt: r.updated_at || r.created_at || '',
  };
}

/** Direction/sender are derived from the row's sender fields: anything sent
 *  by the signed-in user or by their own organization is contractor-side
 *  ('out'); everything else on the project thread is the government's. */
function mapMessageRow(r: any, userId: string | undefined, orgId: string | undefined, orgName: string): Message {
  const ownOrg = Boolean(orgId) && r.sender_organization_id === orgId;
  const mine = r.sender_user_id === userId || ownOrg;
  return {
    id: r.id,
    projectId: r.project_id,
    dir: mine ? 'out' : 'in',
    from: mine ? orgName : 'Government Officer',
    role: mine ? 'Contractor' : 'Government',
    subject: r.subject || '',
    body: r.body || '',
    ts: r.created_at || '',
    ref: r.reference || '',
    status: MESSAGE_STATUS_TO_UI[String(r.status || '').toUpperCase()] ?? 'Sent',
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('nrk-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nrk-theme', theme);
    return () => {
      // Clean up when navigating away from contractor portal
      document.documentElement.classList.remove('dark');
    };
  }, [theme]);

  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('nrk-font')) || 1);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
    localStorage.setItem('nrk-font', String(fontScale));
  }, [fontScale]);

  const [a11y, setA11y] = useState<A11y>(() => (localStorage.getItem('nrk-a11y') ? JSON.parse(localStorage.getItem('nrk-a11y')!) : { hc: false, rm: false, ul: false }));
  useEffect(() => {
    document.body.classList.toggle('hc', a11y.hc);
    document.body.classList.toggle('rm', a11y.rm);
    document.body.classList.toggle('ul', a11y.ul);
    localStorage.setItem('nrk-a11y', JSON.stringify(a11y));
  }, [a11y]);

  const [lang, setLang] = useState('English');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (type: ToastItem['type'], title: string, msg?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-4), { id, type, title, msg }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    },
    []
  );

  // The real organization behind the session (auth.service resolves
  // organization_members(status=active) → organizations(*), which includes
  // gstin / registration_number / status added by migration 024).
  const contractorOrganization: ContractorOrganization | null = session?.organization
    ? {
        id: session.organization.id,
        name: session.organization.name,
        type: session.organization.type,
        registrationNumber: (session.organization as unknown as { registration_number?: string | null }).registration_number ?? null,
        gstin: (session.organization as unknown as { gstin?: string | null }).gstin ?? null,
        department: session.organization.department ?? null,
        state: session.organization.state ?? null,
        district: session.organization.district ?? null,
        verified: session.organization.verified ?? null,
        status: (session.organization as unknown as { status?: string | null }).status ?? null,
      }
    : null;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const markRead = useCallback((id: string) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void (async () => {
      try {
        const { supabase } = await import('@/core/supabase/client');
        await supabase.from('notifications').update({ read_at: new Date().toISOString() } as never).eq('id', id);
      } catch { /* local read state stands; DB sync is best-effort */ }
    })();
  }, []);
  const markAllRead = useCallback(() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))), []);
  const unread = notifications.filter((n) => !n.read).length;

  const [projects, setProjects] = useState<Project[]>([]);
  const [financialUpdates, setFinancialUpdates] = useState<FinancialUpdate[]>([]);
  const [documents, setDocuments] = useState<Record<string, ProjectDoc[]>>({});
  // Migration-037 domains, loaded with the projects below.
  const [workers, setWorkers] = useState<Record<string, Worker[]>>({});
  const [resources, setResources] = useState<Record<string, ResourceRow[]>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadLiveContractorData() {
      try {
        const { supabase } = await import('@/core/supabase/client');
        const { data, error } = await supabase
          .from('contractor_assigned_projects_view')
          .select('*')
          .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
          .limit(100);
        if (error) throw error;

        const records: any[] = (data as any[]) || [];
        if (!isMounted) return;
        const projectIds = records.map((p: any) => p.id).filter(Boolean);
        const orgId = session?.organization?.id;

        // Real planned start dates live on contracts (the view exposes only
        // scheduled_completion_date).
        const startByProject = new Map<string, string>();
        // Open complaints assigned to this contractor org, per project.
        const openComplaintsByProject = new Map<string, number>();
        const milestonesByProject = new Map<string, Project['milestones']>();
        const upcomingByProject = new Map<string, Project['upcoming']>();
        const historyByProject = new Map<string, Project['history']>();
        const spentByProject = new Map<string, number>();
        const finUpdates: FinancialUpdate[] = [];
        const docsByProject: Record<string, ProjectDoc[]> = {};
        const workersByProject: Record<string, Worker[]> = {};
        const resourcesByProject: Record<string, ResourceRow[]> = {};
        const messagesByProject: Record<string, Message[]> = {};
        const invoiceRows: Invoice[] = [];

        if (projectIds.length > 0) {
          const [contractsRes, milestonesRes, inspectionsRes, complaintsRes, financeRes, docsRes, workersRes, resourcesRes, messagesRes, invoicesRes] = await Promise.all([
            orgId
              ? supabase.from('contracts').select('project_id, scheduled_start_date').eq('contractor_organization_id', orgId)
              : Promise.resolve({ data: [] as any[] }),
            supabase.from('project_milestones').select('project_id, milestone_name, planned_end_date, revised_end_date, status, verified_progress').in('project_id', projectIds),
            supabase.from('inspections').select('project_id, inspection_type, scheduled_date, inspection_date, status, summary').in('project_id', projectIds),
            orgId
              ? supabase.from('complaints').select('project_id, status').eq('assigned_organization_id', orgId)
              : Promise.resolve({ data: [] as any[] }),
            supabase.from('financial_updates').select('id, project_id, observation_date, created_at, reported_cost_inr_crore, amount_spent_inr_crore, budget_allocation_inr_crore, revised_cost_inr_crore, cost_overrun_inr_crore, notes').in('project_id', projectIds).order('observation_date', { ascending: false, nullsFirst: false }),
            supabase.from('project_documents').select('id, project_id, document_type, title, publisher, external_url, document_date, created_at').in('project_id', projectIds).order('created_at', { ascending: false }),
            supabase.from('project_workers' as any).select('id, project_id, full_name, role, category, work_area, attendance_percent, hours, status').in('project_id', projectIds).order('created_at', { ascending: true }),
            supabase.from('project_resources' as any).select('id, project_id, name, category, quantity, allocated, used, unit, status').in('project_id', projectIds).order('created_at', { ascending: true }),
            supabase.from('project_messages' as any).select('id, project_id, sender_user_id, sender_organization_id, subject, body, reference, status, created_at').in('project_id', projectIds).order('created_at', { ascending: true }),
            supabase.from('contractor_invoices' as any).select('id, project_id, invoice_number, milestone_label, amount_inr, invoice_date, status, notes, created_at, updated_at').in('project_id', projectIds).order('created_at', { ascending: false }),
          ]);

          for (const c of (contractsRes.data as any[]) || []) {
            if (c.project_id && c.scheduled_start_date) startByProject.set(c.project_id, c.scheduled_start_date);
          }
          for (const m of (milestonesRes.data as any[]) || []) {
            const list = milestonesByProject.get(m.project_id) ?? [];
            list.push({
              name: m.milestone_name || 'Milestone',
              date: m.revised_end_date || m.planned_end_date || '',
              state: m.status === 'COMPLETED' ? 'done' : m.status === 'IN_PROGRESS' ? 'current' : 'pending',
              progress: m.verified_progress != null ? Number(m.verified_progress) : undefined,
            });
            milestonesByProject.set(m.project_id, list);
          }
          for (const i of (inspectionsRes.data as any[]) || []) {
            if (i.status === 'SCHEDULED') {
              const list = upcomingByProject.get(i.project_id) ?? [];
              list.push({ date: i.scheduled_date || '', stage: i.inspection_type || 'Inspection', inspector: 'Department inspector', designation: '' });
              upcomingByProject.set(i.project_id, list);
            } else if (i.status === 'COMPLETED') {
              const list = historyByProject.get(i.project_id) ?? [];
              list.push({
                date: i.inspection_date || i.scheduled_date || '',
                stage: i.inspection_type || 'Inspection',
                inspector: 'Department inspector',
                designation: '',
                result: 'Completed',
                remarks: i.summary || '',
              });
              historyByProject.set(i.project_id, list);
            }
          }
          for (const c of (complaintsRes.data as any[]) || []) {
            if (c.project_id && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(String(c.status || '').toUpperCase())) {
              openComplaintsByProject.set(c.project_id, (openComplaintsByProject.get(c.project_id) ?? 0) + 1);
            }
          }
          for (const f of (financeRes.data as any[]) || []) {
            finUpdates.push({
              id: f.id,
              projectId: f.project_id,
              date: f.observation_date || (f.created_at ? String(f.created_at).slice(0, 10) : ''),
              reportedCostCr: f.reported_cost_inr_crore != null ? Number(f.reported_cost_inr_crore) : null,
              amountSpentCr: f.amount_spent_inr_crore != null ? Number(f.amount_spent_inr_crore) : null,
              budgetAllocationCr: f.budget_allocation_inr_crore != null ? Number(f.budget_allocation_inr_crore) : null,
              revisedCostCr: f.revised_cost_inr_crore != null ? Number(f.revised_cost_inr_crore) : null,
              costOverrunCr: f.cost_overrun_inr_crore != null ? Number(f.cost_overrun_inr_crore) : null,
              notes: f.notes || '',
            });
            // Rows arrive newest-first: the first spent figure per project is the latest.
            if (f.amount_spent_inr_crore != null && !spentByProject.has(f.project_id)) {
              spentByProject.set(f.project_id, Number(f.amount_spent_inr_crore));
            }
          }
          for (const d of (docsRes.data as any[]) || []) {
            const list = docsByProject[d.project_id] ?? [];
            list.push({
              id: d.id,
              name: d.title || 'Document',
              type: d.document_type || 'Document',
              size: '',
              uploaded: d.document_date || (d.created_at ? String(d.created_at).slice(0, 10) : ''),
              by: d.publisher || '',
              url: d.external_url || undefined,
            });
            docsByProject[d.project_id] = list;
          }
          for (const w of (workersRes.data as any[]) || []) {
            const list = workersByProject[w.project_id] ?? [];
            list.push(mapWorkerRow(w));
            workersByProject[w.project_id] = list;
          }
          for (const r of (resourcesRes.data as any[]) || []) {
            const list = resourcesByProject[r.project_id] ?? [];
            list.push(mapResourceRow(r));
            resourcesByProject[r.project_id] = list;
          }
          for (const m of (messagesRes.data as any[]) || []) {
            const list = messagesByProject[m.project_id] ?? [];
            list.push(mapMessageRow(m, session?.user?.id, orgId, contractorOrganization?.name ?? 'Contractor'));
            messagesByProject[m.project_id] = list;
          }
          for (const inv of (invoicesRes.data as any[]) || []) {
            invoiceRows.push(mapInvoiceRow(inv));
          }
        }

        if (!isMounted) return;
        setFinancialUpdates(finUpdates);
        setDocuments(docsByProject);
        setWorkers(workersByProject);
        setResources(resourcesByProject);
        setMessages(messagesByProject);
        setInvoices(invoiceRows);

        const liveProjects: Project[] = records.map((p: any) => {
          const cost = Number(p.contract_value ?? p.total_cost_inr_crore) || 0;
          const progress = Number(p.physical_progress_percent) || 0;
          const sharedStatus = normalizeProjectStatus(p.normalized_status);
          const status: Project['status'] = sharedStatus === 'completed' ? 'Completed' : sharedStatus === 'delayed' ? 'Delayed' : sharedStatus === 'at_risk' ? 'At Risk' : 'Active';
          const start = startByProject.get(p.id) || '';
          const deadline = p.scheduled_completion_date || '';
          const startMs = start ? new Date(start).getTime() : NaN;
          const deadlineMs = deadline ? new Date(deadline).getTime() : NaN;
          const months = Number.isFinite(startMs) && Number.isFinite(deadlineMs) && deadlineMs > startMs
            ? Math.max(0, Math.round((deadlineMs - startMs) / (30.44 * 86400000)))
            : 0;

          return {
            id: p.id || p.nirikshak_project_id,
            code: p.nirikshak_project_id || p.id,
            name: p.project_name || 'Project name not available',
            department: p.project_authority || '',
            deptAbbr: (p.project_authority || '').slice(0, 4).toUpperCase(),
            officer: '', officerRole: '', officerPhone: '', officerEmail: '',
            location: p.location_text || '',
            district: '',
            category: p.sector || p.subsector || '',
            value: cost,
            budgetApproved: cost,
            spent: spentByProject.get(p.id) ?? 0,
            received: 0,
            progress,
            planned: scheduleElapsedPercent(start, deadline),
            start, deadline, months,
            status,
            risk: status === 'Delayed' ? 'High' : status === 'At Risk' ? 'Medium' : 'Low',
            lastUpdate: '', lastUpdateNote: '',
            workOrder: p.contract_number || '',
            scope: '',
            milestones: milestonesByProject.get(p.id) ?? [],
            upcoming: upcomingByProject.get(p.id) ?? [],
            history: historyByProject.get(p.id) ?? [],
            compliance: [], complianceScore: 0,
            expenses: [],
            openComplaints: openComplaintsByProject.get(p.id) ?? 0,
          };
        });
        setProjects(liveProjects);
      } catch (err) {
        console.warn('Failed to load contractor projects from Supabase:', err);
      }
    }
    loadLiveContractorData();
    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, session?.organization?.id]);

  // Real notifications for the signed-in user (public.notifications).
  useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      if (!session?.user?.id) return;
      try {
        const { supabase } = await import('@/core/supabase/client');
        const { data, error } = await supabase
          .from('notifications')
          .select('id, type, title, message, entity_type, entity_id, read_at, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error || !isMounted) return;
        const rows: Notification[] = ((data as any[]) || []).map((n: any) => ({
          id: n.id,
          category: categoryForNotificationType(n.type),
          title: n.title || 'Notification',
          body: n.message || '',
          time: n.created_at || '',
          read: Boolean(n.read_at),
          link: n.entity_type === 'project' && n.entity_id ? `/projects/${n.entity_id}/details` : undefined,
        }));
        if (isMounted) setNotifications(rows);
      } catch { /* notifications stay empty — an honest empty state */ }
    }
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const [reports, setReports] = useState<ProgressReport[]>([]);
  const addReport = useCallback(async (r: Omit<ProgressReport, 'id' | 'submittedAt'>, opts?: { submitToGovernment?: boolean }) => {
    if (opts?.submitToGovernment) {
      // DF-15: submit through the backend route (POST /api/progress/submit),
      // which invokes the submit_progress_update RPC with the caller's JWT
      // and records the evidence rows. Every failure throws — the report is
      // only recorded locally (and success UI only shown) after the backend
      // confirms the submission.
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      if (!apiBaseUrl) throw new Error('Progress submission service is not configured (VITE_API_BASE_URL missing).');

      const { supabase } = await import('@/core/supabase/client');

      // Resolve the project to its database UUID. A failed lookup is a loud
      // error, never a silent skip (the previous implementation warned to
      // the console and still showed the success modal).
      const project = projects.find((item) => item.id === r.projectId || item.code === r.projectId);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let targetProjectId = project && isUuid.test(project.id) ? project.id : isUuid.test(r.projectId) ? r.projectId : null;
      if (!targetProjectId) {
        const lookupCode = project?.code || r.projectId;
        const { data: projData, error: lookupError } = await supabase
          .from('projects')
          .select('id')
          .eq('nirikshak_project_id', lookupCode)
          .maybeSingle();
        if (lookupError) throw new Error(`Could not resolve the project for this update: ${lookupError.message}`);
        if (!projData) throw new Error('Could not resolve the project for this update. The update was not submitted.');
        targetProjectId = (projData as { id: string }).id;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Your session has expired. Please sign in again.');

      const summary = [
        r.completed ? `Completed: ${r.completed}` : '',
        r.planned ? `Planned: ${r.planned}` : '',
        r.challenges ? `Challenges: ${r.challenges}` : '',
      ].filter(Boolean).join('\n');

      // Evidence collected in the form (site photos + documents) is sent as
      // evidence metadata — previously it was silently dropped.
      const evidence = [
        ...r.photos.map((name) => ({ evidence_type: 'photo' as const, storage_path: name, metadata: { file_name: name, source: 'contractor-portal' } })),
        ...r.docs.map((name) => ({ evidence_type: 'report' as const, storage_path: name, metadata: { file_name: name, source: 'contractor-portal' } })),
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      let response: Response;
      try {
        response = await fetch(`${apiBaseUrl}/api/progress/submit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            project_id: targetProjectId,
            reported_progress: r.progress,
            description: summary || 'Physical progress update submitted via Contractor Portal.',
            ...(evidence.length > 0 ? { evidence } : {}),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error?.message || 'The progress update was rejected by the server. It has not been submitted.');
      }
    }

    const id = uid('rep');
    const newRep = { ...r, id, submittedAt: new Date().toISOString() };
    setReports((rs) => [newRep, ...rs]);
    return id;
  }, [projects]);
  const setReportStatus = useCallback((id: string, status: ProgressReport['status'], note?: string) => {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status, reviewerNote: note ?? r.reviewerNote } : r)));
  }, []);

  // ── Migration-037 domains: workers / resources / invoices / messages ─────
  // Every write goes to Supabase first and local state is updated only from
  // the row the database returns; any failure throws to the caller so the
  // UI reports the real error instead of a save that never happened.
  const orgId = contractorOrganization?.id;
  const userId = session?.user?.id;

  const requireOrg = useCallback(() => {
    if (!orgId || !userId) {
      throw new Error('Your session is not linked to a contractor organization, so this cannot be saved to the project record.');
    }
    return { orgId, userId };
  }, [orgId, userId]);

  const addWorker = useCallback(async (projectId: string, w: Omit<Worker, 'id'>) => {
    const { orgId: oid, userId: uidValue } = requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { data, error } = await supabase
      .from('project_workers' as any)
      .insert({
        project_id: projectId,
        contractor_organization_id: oid,
        full_name: w.name,
        role: w.role,
        category: w.category,
        work_area: w.area || null,
        attendance_percent: w.attendance,
        hours: w.hours,
        status: WORKER_STATUS_TO_DB[w.status],
        created_by: uidValue,
      })
      .select('id, project_id, full_name, role, category, work_area, attendance_percent, hours, status')
      .single();
    if (error) throw new Error(`Worker could not be saved: ${error.message}`);
    const row = mapWorkerRow(data);
    setWorkers((ws) => ({ ...ws, [projectId]: [...(ws[projectId] ?? []), row] }));
  }, [requireOrg]);

  const updateWorker = useCallback(async (projectId: string, w: Worker) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { data, error } = await supabase
      .from('project_workers' as any)
      .update({
        full_name: w.name,
        role: w.role,
        category: w.category,
        work_area: w.area || null,
        attendance_percent: w.attendance,
        hours: w.hours,
        status: WORKER_STATUS_TO_DB[w.status],
        updated_at: new Date().toISOString(),
      })
      .eq('id', w.id)
      .select('id, project_id, full_name, role, category, work_area, attendance_percent, hours, status')
      .single();
    if (error) throw new Error(`Worker could not be updated: ${error.message}`);
    const row = mapWorkerRow(data);
    setWorkers((ws) => ({ ...ws, [projectId]: (ws[projectId] ?? []).map((x) => (x.id === row.id ? row : x)) }));
  }, [requireOrg]);

  const removeWorker = useCallback(async (projectId: string, id: string) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { error } = await supabase.from('project_workers' as any).delete().eq('id', id);
    if (error) throw new Error(`Worker could not be removed: ${error.message}`);
    setWorkers((ws) => ({ ...ws, [projectId]: (ws[projectId] ?? []).filter((x) => x.id !== id) }));
  }, [requireOrg]);

  const addResource = useCallback(async (projectId: string, r: Omit<ResourceRow, 'id'>) => {
    const { orgId: oid, userId: uidValue } = requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { data, error } = await supabase
      .from('project_resources' as any)
      .insert({
        project_id: projectId,
        contractor_organization_id: oid,
        name: r.name,
        category: r.category,
        quantity: r.qty,
        allocated: r.allocated,
        used: r.used,
        unit: r.unit,
        status: RESOURCE_STATUS_TO_DB[r.status],
        created_by: uidValue,
      })
      .select('id, project_id, name, category, quantity, allocated, used, unit, status')
      .single();
    if (error) throw new Error(`Resource could not be saved: ${error.message}`);
    const row = mapResourceRow(data);
    setResources((rs) => ({ ...rs, [projectId]: [...(rs[projectId] ?? []), row] }));
  }, [requireOrg]);

  const updateResource = useCallback(async (projectId: string, r: ResourceRow) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { data, error } = await supabase
      .from('project_resources' as any)
      .update({
        name: r.name,
        category: r.category,
        quantity: r.qty,
        allocated: r.allocated,
        used: r.used,
        unit: r.unit,
        status: RESOURCE_STATUS_TO_DB[r.status],
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id)
      .select('id, project_id, name, category, quantity, allocated, used, unit, status')
      .single();
    if (error) throw new Error(`Resource could not be updated: ${error.message}`);
    const row = mapResourceRow(data);
    setResources((rs) => ({ ...rs, [projectId]: (rs[projectId] ?? []).map((x) => (x.id === row.id ? row : x)) }));
  }, [requireOrg]);

  const removeResource = useCallback(async (projectId: string, id: string) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { error } = await supabase.from('project_resources' as any).delete().eq('id', id);
    if (error) throw new Error(`Resource could not be removed: ${error.message}`);
    setResources((rs) => ({ ...rs, [projectId]: (rs[projectId] ?? []).filter((x) => x.id !== id) }));
  }, [requireOrg]);

  const addInvoice = useCallback(async (i: Omit<Invoice, 'id' | 'updatedAt'>) => {
    const { orgId: oid, userId: uidValue } = requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { data, error } = await supabase
      .from('contractor_invoices' as any)
      .insert({
        project_id: i.projectId,
        contractor_organization_id: oid,
        invoice_number: i.no,
        milestone_label: i.milestone || null,
        amount_inr: i.amount,
        invoice_date: i.date,
        status: 'DRAFT',
        notes: i.note || null,
        created_by: uidValue,
      })
      .select('id, project_id, invoice_number, milestone_label, amount_inr, invoice_date, status, notes, created_at, updated_at')
      .single();
    if (error) throw new Error(`Invoice could not be saved: ${error.message}`);
    setInvoices((inv) => [mapInvoiceRow(data), ...inv]);
  }, [requireOrg]);

  const submitInvoice = useCallback(async (id: string) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    // Only a DRAFT can be submitted; statuses beyond that belong to the
    // department's verification/payment workflow and are read-only here.
    const { data, error } = await supabase
      .from('contractor_invoices' as any)
      .update({ status: 'SUBMITTED', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'DRAFT')
      .select('id, project_id, invoice_number, milestone_label, amount_inr, invoice_date, status, notes, created_at, updated_at')
      .single();
    if (error) throw new Error(`Invoice could not be submitted: ${error.message}`);
    const row = mapInvoiceRow(data);
    setInvoices((inv) => inv.map((x) => (x.id === row.id ? row : x)));
  }, [requireOrg]);

  const updateInvoiceNote = useCallback(async (id: string, note: string) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    // Notes are the one field the contractor may still change after
    // submission — the update touches nothing else on the row.
    const { data, error } = await supabase
      .from('contractor_invoices' as any)
      .update({ notes: note || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, project_id, invoice_number, milestone_label, amount_inr, invoice_date, status, notes, created_at, updated_at')
      .single();
    if (error) throw new Error(`Invoice note could not be saved: ${error.message}`);
    const row = mapInvoiceRow(data);
    setInvoices((inv) => inv.map((x) => (x.id === row.id ? row : x)));
  }, [requireOrg]);

  const removeInvoice = useCallback(async (id: string) => {
    requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    // Only drafts can be withdrawn; a submitted invoice is the department's
    // record to act on.
    const { error } = await supabase.from('contractor_invoices' as any).delete().eq('id', id).eq('status', 'DRAFT');
    if (error) throw new Error(`Invoice could not be deleted: ${error.message}`);
    setInvoices((inv) => inv.filter((x) => x.id !== id));
  }, [requireOrg]);

  const sendMessage = useCallback(async (m: { projectId: string; subject: string; body: string }) => {
    const { orgId: oid, userId: uidValue } = requireOrg();
    const { supabase } = await import('@/core/supabase/client');
    const { data, error } = await supabase
      .from('project_messages' as any)
      .insert({
        project_id: m.projectId,
        sender_user_id: uidValue,
        sender_organization_id: oid,
        subject: m.subject,
        body: m.body,
      })
      .select('id, project_id, sender_user_id, sender_organization_id, subject, body, reference, status, created_at')
      .single();
    if (error) throw new Error(`Message could not be sent: ${error.message}`);
    const row = mapMessageRow(data, uidValue, oid, contractorOrganization?.name ?? 'Contractor');
    setMessages((ms) => ({ ...ms, [m.projectId]: [...(ms[m.projectId] ?? []), row] }));
  }, [requireOrg, contractorOrganization?.name]);

  // Documents are backed by public.project_documents: the list is loaded with
  // the projects above; adding writes the metadata row and only updates local
  // state after the database confirms. Any failure throws to the caller.
  const addDocument = useCallback(async (projectId: string, d: Omit<ProjectDoc, 'id' | 'uploaded' | 'by'>) => {
    const { supabase } = await import('@/core/supabase/client');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error('Your session has expired. Please sign in again.');
    const { data, error } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        document_type: d.type,
        title: d.name,
        uploaded_by: userId,
        publisher: contractorOrganization?.name ?? null,
      } as never)
      .select('id, created_at')
      .single();
    if (error) throw new Error(`Document metadata could not be saved: ${error.message}`);
    const row = data as unknown as { id: string; created_at: string };
    setDocuments((ds) => ({
      ...ds,
      [projectId]: [
        {
          id: row.id,
          name: d.name,
          type: d.type,
          size: d.size,
          uploaded: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
          by: contractorOrganization?.name ?? '',
        },
        ...(ds[projectId] ?? []),
      ],
    }));
  }, [contractorOrganization?.name]);

  // Local bid state starts empty: server bids (ContractorTenderService
  // .getMyBids) are the truth; the store never invents a bid or a reference.
  const [bids, setBids] = useState<Record<string, Bid>>({});
  const saveBidDraft = useCallback((tenderId: string, step: number, data: Record<string, unknown>) => {
    setBids((bs) => ({
      ...bs,
      [tenderId]: {
        ...(bs[tenderId] ?? { tenderId, status: 'Draft' as const }),
        tenderId,
        status: 'Draft',
        step,
        updatedAt: new Date().toISOString(),
        data,
      },
    }));
  }, []);
  const submitBid = useCallback((tenderId: string, bidValue: number, bidReference: string) => {
    // Only the server-issued bid reference (NIR-BID-…, generated by the
    // save_tender_bid RPC) may be recorded — a locally invented reference
    // (the old NRK-BID-… generator) diverged from the database truth.
    if (!bidReference) {
      throw new Error('Cannot record a submitted bid without the server-issued bid reference.');
    }
    setBids((bs) => ({
      ...bs,
      [tenderId]: {
        ...(bs[tenderId] ?? { tenderId, step: 7, data: {} }),
        tenderId,
        status: 'Submitted',
        step: 7,
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        ref: bidReference,
        bidValue,
      },
    }));
    return bidReference;
  }, []);

  const [savedTenders, setSavedTenders] = useState<string[]>([]);
  const toggleSaveTender = useCallback((id: string) => {
    setSavedTenders((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const value: Store = {
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    fontScale,
    stepFont: (dir) => setFontScale((f) => Math.min(1.25, Math.max(0.875, Math.round((f + dir * 0.125) * 1000) / 1000))),
    a11y,
    toggleA11y: (k) => setA11y((a) => ({ ...a, [k]: !a[k] })),
    lang,
    setLang,
    toasts,
    toast,
    dismissToast,
    contractorOrganization,
    notifications,
    unread,
    markRead,
    markAllRead,
    projects,
    reports,
    addReport,
    setReportStatus,
    workers,
    addWorker,
    updateWorker,
    removeWorker,
    resources,
    addResource,
    updateResource,
    removeResource,
    invoices,
    addInvoice,
    submitInvoice,
    updateInvoiceNote,
    removeInvoice,
    messages,
    sendMessage,
    documents,
    addDocument,
    financialUpdates,
    bids,
    saveBidDraft,
    submitBid,
    savedTenders,
    toggleSaveTender,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
