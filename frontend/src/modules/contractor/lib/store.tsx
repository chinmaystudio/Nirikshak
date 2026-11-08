import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToastItem } from '../components/ui';
import {
  INITIAL_NOTIFICATIONS, INITIAL_WORKERS, INITIAL_RESOURCES, INITIAL_INVOICES,
  INITIAL_REPORTS, INITIAL_MESSAGES, INITIAL_DOCS,
} from './data';
import type {
  Notification, Worker, ResourceRow, Invoice, ProgressReport, Message,
  ProjectDoc, Bid, Project,
} from './data';
import { uid } from './utils';
import { PROJECTS } from './data';
import { normalizeProjectStatus } from '@/core/status/projectStatus';
import { useAuth } from '@/core/auth/useAuth';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_USE_MOCK_API === 'true';

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
  // With { submitToGovernment: true } the report is submitted through the
  // backend (POST /api/progress/submit, evidence included) BEFORE it is
  // recorded locally; the returned promise rejects on any failure so callers
  // can block their success UI. Without the flag it only records a local draft.
  addReport: (r: Omit<ProgressReport, 'id' | 'submittedAt'>, opts?: { submitToGovernment?: boolean }) => Promise<string>;
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

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

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

  const [notifications, setNotifications] = useState<Notification[]>(() => DEMO_MODE ? clone(INITIAL_NOTIFICATIONS) : []);
  const markRead = useCallback((id: string) => setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))), []);
  const unread = notifications.filter((n) => !n.read).length;

  const [projects, setProjects] = useState<Project[]>(() => DEMO_MODE ? clone(PROJECTS) : []);

  useEffect(() => {
    let isMounted = true;
    async function loadLiveContractorProjects() {
      try {
        const { supabase } = await import('@/core/supabase/client');
        const { data, error } = await supabase
          .from('contractor_assigned_projects_view')
          .select('*')
          .order('total_cost_inr_crore', { ascending: false, nullsFirst: false })
          .limit(100);

        let records: any[] = (data as any[]) || [];

        if (records && records.length > 0 && isMounted) {
          const liveProjects: Project[] = records.map((p: any) => {
            const cost = Number(p.contract_value ?? p.total_cost_inr_crore) || 0;
            const progress = Number(p.physical_progress_percent) || 0;
            const sharedStatus = normalizeProjectStatus(p.normalized_status);
            const status: Project['status'] = sharedStatus === 'completed' ? 'Completed' : sharedStatus === 'delayed' ? 'Delayed' : sharedStatus === 'at_risk' ? 'At Risk' : 'Active';

            const projId = p.nirikshak_project_id || p.id;
            return {
              id: p.id || projId,
              code: projId,
              name: p.project_name || 'Project name not available',
              department: p.project_authority || 'Not available',
              deptAbbr: (p.project_authority || 'N/A').slice(0, 4).toUpperCase(),
              officer: 'Not available', officerRole: 'Not available', officerPhone: '', officerEmail: '',
              location: p.location_text || 'Not available', district: 'Not available',
              category: p.sector || p.subsector || 'Not available',
              value: cost,
              budgetApproved: cost, spent: 0, received: 0,
              progress,
              planned: Math.min(100, progress + 8),
              start: '', deadline: p.scheduled_completion_date || '', months: 0,
              status,
              risk: status === 'Delayed' ? 'High' : status === 'At Risk' ? 'Medium' : 'Low',
              lastUpdate: '', lastUpdateNote: 'No verified update metadata available.',
              workOrder: p.contract_number || 'Not available', scope: 'Not available',
              milestones: [], upcoming: [], history: [], compliance: [], complianceScore: 0,
              forecast: {
                predicted: p.scheduled_completion_date || '', earlyDays: 0, confidence: 0, factors: [], actions: [],
              },
              health: {
                overall: status === 'Delayed' ? 'POOR' : progress > 50 ? 'GOOD' : 'FAIR',
                score: Math.round(progress),
                scores: [],
                risks: [],
              },
              expenses: [],
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
  }, [session?.user?.id, session?.organization?.id]);

  const [reports, setReports] = useState<ProgressReport[]>(() => DEMO_MODE ? clone(INITIAL_REPORTS) : []);
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

  const [workers, setWorkers] = useState<Record<string, Worker[]>>(() => DEMO_MODE ? clone(INITIAL_WORKERS) : {});
  const addWorker = useCallback((projectId: string, w: Omit<Worker, 'id'>) => {
    setWorkers((ws) => ({ ...ws, [projectId]: [...(ws[projectId] ?? []), { ...w, id: uid('w') }] }));
  }, []);
  const updateWorker = useCallback((projectId: string, w: Worker) => {
    setWorkers((ws) => ({ ...ws, [projectId]: (ws[projectId] ?? []).map((x) => (x.id === w.id ? w : x)) }));
  }, []);
  const removeWorker = useCallback((projectId: string, id: string) => {
    setWorkers((ws) => ({ ...ws, [projectId]: (ws[projectId] ?? []).filter((x) => x.id !== id) }));
  }, []);

  const [resources, setResources] = useState<Record<string, ResourceRow[]>>(() => DEMO_MODE ? clone(INITIAL_RESOURCES) : {});
  const addResource = useCallback((projectId: string, r: Omit<ResourceRow, 'id'>) => {
    setResources((rs) => ({ ...rs, [projectId]: [...(rs[projectId] ?? []), { ...r, id: uid('r') }] }));
  }, []);

  const [invoices, setInvoices] = useState<Invoice[]>(() => DEMO_MODE ? clone(INITIAL_INVOICES) : []);
  const addInvoice = useCallback((i: Omit<Invoice, 'id'>) => {
    setInvoices((inv) => [{ ...i, id: uid('i') }, ...inv]);
  }, []);
  const submitInvoice = useCallback((id: string) => {
    setInvoices((inv) => inv.map((i) => (i.id === id && i.status === 'Draft' ? { ...i, status: 'Submitted', verification: 'Awaiting DyE check' } : i)));
  }, []);

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => DEMO_MODE ? clone(INITIAL_MESSAGES) : {});
  const sendMessage = useCallback((m: Omit<Message, 'id' | 'ts' | 'status'>) => {
    const id = uid('m');
    setMessages((ms) => ({
      ...ms,
      [m.projectId]: [...(ms[m.projectId] ?? []), { ...m, id, ts: new Date().toISOString(), status: 'Sent' }],
    }));
    if (!DEMO_MODE) return;
    // Demo-only acknowledgement from government office
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

  const [documents, setDocuments] = useState<Record<string, ProjectDoc[]>>(() => DEMO_MODE ? clone(INITIAL_DOCS) : {});
  const addDocument = useCallback((projectId: string, d: Omit<ProjectDoc, 'id' | 'uploaded' | 'by'>) => {
    setDocuments((ds) => ({
      ...ds,
      [projectId]: [
        ...(ds[projectId] ?? []),
        { ...d, id: uid('d'), uploaded: new Date().toISOString().slice(0, 10), by: 'Balaji Infraprojects' },
      ],
    }));
  }, []);

  // Local bid state starts empty: server bids (ContractorTenderService
  // .getMyBids) are the truth, and the demo INITIAL_BIDS fixtures now live in
  // src/demo/contractorDemoData.ts, unimported by live code.
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
