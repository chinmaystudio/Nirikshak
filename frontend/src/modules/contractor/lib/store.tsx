import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToastItem } from '../components/ui';
import {
  INITIAL_NOTIFICATIONS, INITIAL_WORKERS, INITIAL_RESOURCES, INITIAL_INVOICES,
  INITIAL_REPORTS, INITIAL_MESSAGES, INITIAL_DOCS, INITIAL_BIDS,
} from './data';
import type {
  Notification, Worker, ResourceRow, Invoice, ProgressReport, Message,
  ProjectDoc, Bid, Project,
} from './data';
import { uid } from './utils';
import { PROJECTS } from './data';

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

  notifications: Notification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;

  projects: Project[];
  reports: ProgressReport[];
  addReport: (r: Omit<ProgressReport, 'id' | 'submittedAt'>) => string;
  setReportStatus: (id: string, status: ProgressReport['status'], note?: string) => void;

  workers: Record<string, Worker[]>;
  addWorker: (projectId: string, w: Omit<Worker, 'id'>) => void;
  updateWorker: (projectId: string, w: Worker) => void;
  removeWorker: (projectId: string, id: string) => void;

  resources: Record<string, ResourceRow[]>;
  addResource: (projectId: string, r: Omit<ResourceRow, 'id'>) => void;

  invoices: Invoice[];
  addInvoice: (i: Omit<Invoice, 'id'>) => void;
  submitInvoice: (id: string) => void;

  messages: Record<string, Message[]>;
  sendMessage: (m: Omit<Message, 'id' | 'ts' | 'status'>) => void;

  documents: Record<string, ProjectDoc[]>;
  addDocument: (projectId: string, d: Omit<ProjectDoc, 'id' | 'uploaded' | 'by'>) => void;

  bids: Record<string, Bid>;
  saveBidDraft: (tenderId: string, step: number, data: Record<string, unknown>) => void;
  submitBid: (tenderId: string, bidValue: number) => string;

  savedTenders: string[];
  toggleSaveTender: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('nrk-theme') as 'light' | 'dark') || 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nrk-theme', theme);
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

  const [notifications, setNotifications] = useState<Notification[]>(() => clone(INITIAL_NOTIFICATIONS));
  const markRead = useCallback((id: string) => setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))), []);
  const unread = notifications.filter((n) => !n.read).length;

  const [projects, setProjects] = useState<Project[]>(() => clone(PROJECTS));

  useEffect(() => {
    let isMounted = true;
    async function loadLiveContractorProjects() {
      try {
        const { supabase } = await import('@/core/supabase/client');
        const { data, error } = await supabase
          .from('projects')
          .select('*, project_milestones(*), contracts(*)')
          .or('city.eq.Pune,location_text.ilike.%Pune%')
          .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
          .limit(8);

        if (!error && data && data.length > 0 && isMounted) {
          const liveProjects: Project[] = data.map((p: any, idx: number) => {
            const cost = Number(p.total_cost_inr_crore) || 75.5;
            const progress = Number(p.physical_progress_percent) || (idx === 0 ? 94 : idx === 1 ? 65 : 48);
            const spent = Number(p.amount_spent_inr_crore) || (cost * (progress / 100));
            const received = Math.round(spent * 0.95);
            const st = String(p.normalized_status || '').toUpperCase();
            const status: Project['status'] =
              st === 'COMPLETED' ? 'Completed' : st === 'DELAYED' ? 'Delayed' : progress < 50 ? 'At Risk' : 'Active';

            const projId = p.nirikshak_project_id || p.id;
            const slotId = idx < 6 ? `p${idx + 1}` : projId;
            return {
              id: slotId,
              code: projId,
              name: p.project_name || 'Infrastructure Project',
              department: p.project_authority || p.implementing_agency || 'Pune Municipal Corporation',
              deptAbbr: (p.project_authority || 'PMC').slice(0, 4).toUpperCase(),
              officer: 'Er. Suhas Joshi',
              officerRole: 'Executive Engineer',
              officerPhone: '+91 98230 45678',
              officerEmail: 'ee.pwd.pune@maharashtra.gov.in',
              location: p.location_text || 'Pune, Maharashtra',
              district: p.district || 'Pune',
              category: p.sector || 'Roads & Bridges',
              value: cost,
              budgetApproved: Number(p.revised_cost_inr_crore) || cost,
              spent,
              received,
              progress,
              planned: Math.min(100, progress + 8),
              start: p.award_date || p.planned_start_date || '2023-01-15',
              deadline: p.original_completion_date || p.revised_completion_date || '2026-12-31',
              months: 24,
              status,
              risk: status === 'Delayed' ? 'High' : status === 'At Risk' ? 'Medium' : 'Low',
              lastUpdate: '2026-02-15',
              lastUpdateNote: 'Quarterly physical progress audit and e-MB measurement completed.',
              workOrder: `WO-MH-${projId.slice(-6)}`,
              scope: p.description || p.public_summary || 'Authoritative public works contract under NIRIKSHAK audit monitoring.',
              milestones: (p.project_milestones && p.project_milestones.length > 0)
                ? p.project_milestones.map((m: any) => ({
                    name: m.milestone_name || 'Project Milestone',
                    date: m.planned_completion_date || '2025-06-30',
                    state: m.status === 'COMPLETED' ? 'done' : m.status === 'IN_PROGRESS' ? 'current' : 'pending',
                    progress: Number(m.physical_progress_weight) || 50,
                  }))
                : [
                    { name: 'Site Clearing & Substructure Piling', date: '2024-03-31', state: 'done', progress: 100 },
                    { name: 'Superstructure & Viaduct Launching', date: '2025-09-30', state: progress >= 60 ? 'done' : 'current', progress: Math.min(100, Math.round(progress * 1.3)) },
                    { name: 'Finishing, Testing & Safety Certification', date: p.original_completion_date || '2026-12-31', state: progress >= 100 ? 'done' : 'pending', progress: progress >= 100 ? 100 : 0 },
                  ],
              upcoming: [
                { date: '2026-03-15', time: '10:30 AM', stage: 'Concrete Core Strength Test', inspector: 'Er. R. K. Shinde', designation: 'Superintending Engineer' },
              ],
              history: [
                { date: '2026-01-20', stage: 'Pier Cap Quality Inspection', inspector: 'Er. V. Deshmukh', designation: 'Third-Party Quality Auditor', result: 'Passed', remarks: 'Core sample strength verified according to M35 IRC standards.' },
              ],
              compliance: [
                { name: 'Labour Cess & EPF Remittance', status: 'ok', note: 'Challan verified for FY 2025-26 Q3' },
                { name: 'Environmental MoEF Clearance', status: 'ok', note: 'Air & noise monitoring compliant' },
                { name: 'Third-Party Quality Assurance Certificate', status: 'ok', note: 'Submitted to PMU' },
              ],
              complianceScore: 94,
              forecast: {
                predicted: p.revised_completion_date || '2026-11-30',
                earlyDays: 14,
                confidence: 88,
                factors: [
                  { label: 'Material Supply Rate', value: 92, detail: 'Consistent supply of steel and RMC' },
                  { label: 'Labour Availability', value: 85, detail: 'Adequate skilled manpower on site' },
                ],
                actions: [
                  { label: 'Accelerate span 4 girder lifting', impact: '+5 days recovery' },
                ],
              },
              health: {
                overall: status === 'Delayed' ? 'POOR' : progress > 50 ? 'GOOD' : 'FAIR',
                score: Math.round(progress),
                scores: [
                  { label: 'Schedule Adherence', value: status === 'Delayed' ? 55 : 88 },
                  { label: 'Financial Burn Rate', value: 84 },
                  { label: 'Safety Compliance', value: 96 },
                ],
                risks: [],
              },
              expenses: [
                { label: 'Civil Structures & Concrete', budget: cost * 0.45, spent: spent * 0.45 },
                { label: 'Earthworks & Subbase', budget: cost * 0.25, spent: spent * 0.25 },
                { label: 'MEP & Safety Signage', budget: cost * 0.30, spent: spent * 0.30 },
              ],
            };
          });
          setProjects(liveProjects);
        }
      } catch (err) {
        console.warn('Failed to load contractor projects from Supabase:', err);
      }
    }
    loadLiveContractorProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  const [reports, setReports] = useState<ProgressReport[]>(() => clone(INITIAL_REPORTS));
  const addReport = useCallback((r: Omit<ProgressReport, 'id' | 'submittedAt'>) => {
    const id = uid('rep');
    const newRep = { ...r, id, submittedAt: new Date().toISOString() };
    setReports((rs) => [newRep, ...rs]);

    // Send to Supabase progress_updates for real Government review
    try {
      import('@/core/supabase/client').then(({ supabase }) => {
        supabase.from('progress_updates').insert({
          project_id: 'b1000000-0000-0000-0000-000000000001',
          contractor_organization_id: '55555555-5555-5555-5555-555555555555',
          reported_progress: (r as any).physicalProgress || 92.5,
          description: (r as any).summary || (r as any).highlights || 'Contractor progress report submission',
          verification_status: 'SUBMITTED',
        }).then(({ error }) => {
          if (error) console.warn('Contractor progress Supabase sync notice:', error.message);
        });
      });
    } catch {
      /* offline or mock */
    }

    return id;
  }, []);
  const setReportStatus = useCallback((id: string, status: ProgressReport['status'], note?: string) => {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status, reviewerNote: note ?? r.reviewerNote } : r)));
  }, []);

  const [workers, setWorkers] = useState<Record<string, Worker[]>>(() => clone(INITIAL_WORKERS));
  const addWorker = useCallback((projectId: string, w: Omit<Worker, 'id'>) => {
    setWorkers((ws) => ({ ...ws, [projectId]: [...(ws[projectId] ?? []), { ...w, id: uid('w') }] }));
  }, []);
  const updateWorker = useCallback((projectId: string, w: Worker) => {
    setWorkers((ws) => ({ ...ws, [projectId]: (ws[projectId] ?? []).map((x) => (x.id === w.id ? w : x)) }));
  }, []);
  const removeWorker = useCallback((projectId: string, id: string) => {
    setWorkers((ws) => ({ ...ws, [projectId]: (ws[projectId] ?? []).filter((x) => x.id !== id) }));
  }, []);

  const [resources, setResources] = useState<Record<string, ResourceRow[]>>(() => clone(INITIAL_RESOURCES));
  const addResource = useCallback((projectId: string, r: Omit<ResourceRow, 'id'>) => {
    setResources((rs) => ({ ...rs, [projectId]: [...(rs[projectId] ?? []), { ...r, id: uid('r') }] }));
  }, []);

  const [invoices, setInvoices] = useState<Invoice[]>(() => clone(INITIAL_INVOICES));
  const addInvoice = useCallback((i: Omit<Invoice, 'id'>) => {
    setInvoices((inv) => [{ ...i, id: uid('i') }, ...inv]);
  }, []);
  const submitInvoice = useCallback((id: string) => {
    setInvoices((inv) => inv.map((i) => (i.id === id && i.status === 'Draft' ? { ...i, status: 'Submitted', verification: 'Awaiting DyE check' } : i)));
  }, []);

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => clone(INITIAL_MESSAGES));
  const sendMessage = useCallback((m: Omit<Message, 'id' | 'ts' | 'status'>) => {
    const id = uid('m');
    setMessages((ms) => ({
      ...ms,
      [m.projectId]: [...(ms[m.projectId] ?? []), { ...m, id, ts: new Date().toISOString(), status: 'Sent' }],
    }));
    // Simulated acknowledgement from government office
    window.setTimeout(() => {
      setMessages((ms) => {
        const list = (ms[m.projectId] ?? []).map((x) => (x.id === id ? { ...x, status: 'Read' as const } : x));
        return {
          ...ms,
          [m.projectId]: [
            ...list,
            {
              id: uid('m'),
              projectId: m.projectId,
              dir: 'in' as const,
              from: 'Office of the Executive Engineer',
              role: 'Secretariat, Government of Maharashtra',
              subject: `Re: ${m.subject}`,
              type: 'Response' as const,
              body: 'Your communication has been received and acknowledged. It has been marked to the concerned section for further action. Reference number may please be quoted in future correspondence.',
              ts: new Date().toISOString(),
              ref: `GOV/ACK/${Math.floor(1000 + Math.random() * 9000)}`,
              status: 'Read' as const,
            },
          ],
        };
      });
    }, 2600);
  }, []);

  const [documents, setDocuments] = useState<Record<string, ProjectDoc[]>>(() => clone(INITIAL_DOCS));
  const addDocument = useCallback((projectId: string, d: Omit<ProjectDoc, 'id' | 'uploaded' | 'by'>) => {
    setDocuments((ds) => ({
      ...ds,
      [projectId]: [
        ...(ds[projectId] ?? []),
        { ...d, id: uid('d'), uploaded: new Date().toISOString().slice(0, 10), by: 'Balaji Infraprojects' },
      ],
    }));
  }, []);

  const [bids, setBids] = useState<Record<string, Bid>>(() => clone(INITIAL_BIDS));
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
  const submitBid = useCallback((tenderId: string, bidValue: number) => {
    const ref = `NRK-BID-2026-${Math.floor(3200 + Math.random() * 700)}`;
    setBids((bs) => ({
      ...bs,
      [tenderId]: {
        ...(bs[tenderId] ?? { tenderId, step: 7, data: {} }),
        tenderId,
        status: 'Submitted',
        step: 7,
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        ref,
        bidValue,
      },
    }));
    return ref;
  }, []);

  const [savedTenders, setSavedTenders] = useState<string[]>(['t2', 't7']);
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
    invoices,
    addInvoice,
    submitInvoice,
    messages,
    sendMessage,
    documents,
    addDocument,
    bids,
    saveBidDraft,
    submitBid,
    savedTenders,
    toggleSaveTender,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
