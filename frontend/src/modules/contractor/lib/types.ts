// ─── NIRIKSHAK Contractor Portal — shared types ─────────────────────────────
// Types only. All VALUES in this portal come from Supabase / the backend API
// (see lib/store.tsx loaders). There is deliberately no bundled dataset in
// this module.

export type ProjectStatus = 'Active' | 'At Risk' | 'Delayed' | 'Completed';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type MilestoneState = 'done' | 'current' | 'pending';

export interface Milestone {
  name: string;
  date: string;
  state: MilestoneState;
  progress?: number;
}

export interface Inspection {
  date: string;
  time?: string;
  stage: string;
  inspector: string;
  designation: string;
}

export interface InspectionRecord {
  date: string;
  stage: string;
  inspector: string;
  designation: string;
  result: string;
  remarks: string;
  corrective?: string;
}

export interface ComplianceItem {
  name: string;
  status: 'ok' | 'warn';
  note: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  department: string;
  deptAbbr: string;
  officer: string;
  officerRole: string;
  officerPhone: string;
  officerEmail: string;
  location: string;
  district: string;
  category: string;
  value: number; // ₹ Cr — contract value (contracts.contract_value / project cost)
  budgetApproved: number; // ₹ Cr
  spent: number; // ₹ Cr — latest department financial_updates.amount_spent_inr_crore, 0 when no record
  received: number; // ₹ Cr — no payment-receipt source exists yet; stays 0 and is not displayed as fact
  progress: number; // physical_progress_percent from the assigned-projects view
  planned: number; // SCHEDULE ELAPSED % — elapsed fraction of the planned duration (start→deadline), NOT a progress forecast
  start: string;
  deadline: string;
  months: number;
  status: ProjectStatus;
  risk: RiskLevel;
  lastUpdate: string;
  lastUpdateNote: string;
  workOrder: string;
  scope: string;
  milestones: Milestone[];
  upcoming: Inspection[];
  history: InspectionRecord[];
  compliance: ComplianceItem[];
  complianceScore: number;
  expenses: { label: string; budget: number; spent: number }[];
  openComplaints: number; // complaints assigned to the contractor org, not yet resolved/closed
}

/** Computed project health — see projectHealth() in lib/health.ts for the formula. */
export interface ProjectHealth {
  score: number; // 0–100
  overall: 'GOOD' | 'FAIR' | 'POOR';
  scheduleShortfall: number; // max(0, scheduleElapsed − progress)
  complaintsPenalty: number;
  overduePenalty: number;
  overdue: boolean;
}

/** One row of public.project_workers (migration 037). Field names map to
 *  full_name / work_area / attendance_percent; attendance and hours are
 *  nullable in the table and stay null here when not recorded. The table
 *  has no phone column, so none is modelled. */
export interface Worker {
  id: string;
  name: string;
  role: string;
  category: 'Skilled' | 'Unskilled' | 'Supervisor';
  area: string;
  attendance: number | null; // attendance_percent
  hours: number | null;
  status: 'Active' | 'On Leave' | 'Transferred';
}

/** One row of public.project_resources (migration 037); qty maps to the
 *  table's quantity column. */
export interface ResourceRow {
  id: string;
  name: string;
  category: 'Machinery' | 'Equipment' | 'Vehicles' | 'Materials';
  qty: number;
  allocated: number;
  used: number;
  unit: string;
  status: 'Available' | 'In Use' | 'Low Stock' | 'Idle';
}

export type InvoiceStatus = 'Draft' | 'Submitted' | 'Under Verification' | 'Approved' | 'Rejected' | 'Paid';

/** One row of public.contractor_invoices (migration 037). `no` is the
 *  contractor's own invoice_number, entered by the contractor — never
 *  generated here. `date` is invoice_date; `amount` is amount_inr (₹).
 *  Statuses past Draft are set by the department (verification / approval /
 *  payment); the contractor can still edit `note` (the notes column).
 *  Department-recorded finance lives in FinancialUpdate below. */
export interface Invoice {
  id: string;
  no: string;
  projectId: string;
  milestone: string; // milestone_label, '' when not recorded
  amount: number; // ₹ (amount_inr)
  date: string;
  status: InvoiceStatus;
  note?: string;
  updatedAt: string;
}

/** One row of public.financial_updates — finance as recorded by the department. */
export interface FinancialUpdate {
  id: string;
  projectId: string;
  date: string;
  reportedCostCr: number | null;
  amountSpentCr: number | null;
  budgetAllocationCr: number | null;
  revisedCostCr: number | null;
  costOverrunCr: number | null;
  notes: string;
}

export interface ProgressReport {
  id: string;
  projectId: string;
  milestone: string;
  progress: number;
  prevProgress: number;
  completed: string;
  planned: string;
  challenges: string;
  photos: string[];
  docs: string[];
  /** Files behind `photos` / `docs`, uploaded to progress-evidence on submit. */
  photoFiles?: File[];
  docFiles?: File[];
  submittedAt: string;
  status: 'Draft' | 'Submitted' | 'Under Government Review' | 'Approved' | 'Changes Requested';
  reviewerNote?: string;
}

/** One row of public.project_messages (migration 037). `ref` is the
 *  server-generated reference (NIR-MSG-…); `ts` is created_at. The table
 *  has no message-type or attachments column, so neither is modelled.
 *  `dir`/`from`/`role` are derived from the sender at load time: messages
 *  from the contractor's own organization are 'out', government messages
 *  are 'in'. Status is set by the department (READ / ACTION_REQUIRED /
 *  RESPONDED) after the contractor's SENT. */
export interface Message {
  id: string;
  projectId: string;
  dir: 'in' | 'out';
  from: string;
  role: string;
  subject: string;
  body: string;
  ts: string;
  ref: string;
  status: 'Sent' | 'Read' | 'Action Required' | 'Responded';
}

/** One row of public.project_documents (metadata only; file bytes live in storage). */
export interface ProjectDoc {
  id: string;
  name: string;
  type: string;
  size: string;
  uploaded: string;
  by: string;
  url?: string;
}

export type NotifCategory = 'Project' | 'Tender' | 'Finance' | 'Inspection' | 'Government' | 'Compliance' | 'AI Alerts';

export interface Notification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  project?: string;
  amount?: string;
  time: string;
  read: boolean;
  link?: string;
}

export type EventType = 'Project' | 'Inspection' | 'Payment' | 'Tender' | 'Government' | 'Compliance';

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  type: EventType;
  time?: string;
  link?: string;
}

export interface Tender {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  value: number; // ₹ Cr
  deadline: string;
  emd: number; // ₹
  category: string;
  durationMonths: number;
  opened: string;
  preBid: string;
  status: 'Open' | 'Closed';
  summary: string;
  scopePoints: string[];
  eligibility: { label: string; required: string };
  techReq: string[];
  finReq: string[];
  docs: string[];
  timeline: { label: string; date: string }[];
  contact: { name: string; role: string; phone: string; email: string };
}

export interface Bid {
  tenderId: string;
  status: 'Draft' | 'Submitted' | 'Under Evaluation' | 'Awarded' | 'Rejected' | 'Lost';
  step: number;
  updatedAt: string;
  ref?: string;
  submittedAt?: string;
  bidValue?: number;
  data: Record<string, unknown>;
}

/** The signed-in contractor's real organization (organizations row via
 *  organization_members). Fields the table does not have are absent — the UI
 *  renders "—" for them, never an invented value. */
export interface ContractorOrganization {
  id: string;
  name: string;
  type: string;
  registrationNumber: string | null; // organizations.registration_number (CIN for companies)
  gstin: string | null; // organizations.gstin
  department: string | null;
  state: string | null;
  district: string | null;
  verified: boolean | null;
  status: string | null;
}

export function pendingForProject(projectId: string, invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.projectId === projectId && ['Submitted', 'Under Verification', 'Approved'].includes(i.status))
    .reduce((s, i) => s + i.amount, 0);
}

export function paidForProject(projectId: string, invoices: Invoice[]): number {
  return invoices.filter((i) => i.projectId === projectId && i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
}
