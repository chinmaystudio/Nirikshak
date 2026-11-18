/** NIRIKSHAK domain types — shared vocabulary across pages, data and mock API. */

/* ---------- Shared status vocabulary (never color-only; icon+text+tint) ---------- */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface StatusDescriptor {
  /** i18n key suffix, e.g. status.on_track */
  key: string
  tone: StatusTone
  /** Material Symbols ligature name */
  icon: string
}

export type ProjectStatus =
  | 'sanctioned'
  | 'in_execution'
  | 'delayed'
  | 'at_risk'
  | 'completed'
  | 'on_hold'
  | 'tendered'
  | 'awarded'

export type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed' | 'delayed' | 'blocked'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'clarification'

export type TenderStatus =
  | 'draft'
  | 'published'
  | 'bid_open'
  | 'closed'
  | 'under_evaluation'
  | 'awarded'
  | 'cancelled'

export type GrievanceStatus =
  | 'submitted'
  | 'acknowledged'
  | 'in_review'
  | 'action_taken'
  | 'resolved'
  | 'closed'
  | 'rejected'

export type LitigationStatus = 'open' | 'under_review' | 'hearing_scheduled' | 'resolved' | 'closed'

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AlertSeverity = 'info' | 'warning' | 'critical'

/* ---------- Core entities ---------- */
export interface Department {
  id: string
  name: string
  nameHi: string
  nameMr: string
  code: string
}

export interface Contractor {
  /** organizations.id (UUID) */
  id: string
  name: string
  /** organizations.registration_number — null when not recorded */
  registrationNo: string | null
  /** organizations.verified */
  verified?: boolean
  /** organizations.created_at date — when the organisation record was created */
  empanelledSince?: string | null
  district?: string | null
  state?: string | null
  department?: string | null
  /** Project UUIDs linked via contracts + project_organizations */
  projectIds?: string[]
  assignedProjects?: number
  activeProjects: number
  completedProjects: number
  /** Sum of contracts.contract_value (₹ Cr) */
  totalValueCr: number
  activeContracts?: number
  /** Mean physical_progress_percent across linked projects; null when none */
  averageProgressPct?: number | null
  /* Legacy demo-only fields — never populated by the real API; kept optional
     so the (still-referenced) demo dataset file type-checks until removed. */
  class?: 'Class A' | 'Class B' | 'Class C'
  districts?: string[]
  aiScore?: number
  scoreBand?: 'excellent' | 'good' | 'average' | 'poor'
  onTimeCompletionPct?: number
  qualityRating?: number
  pendingDefects?: number
  litigationCount?: number
  strengths?: string[]
  risks?: string[]
}

/** Real-data contractor evaluation, computed from contracts,
 * project_organizations and projects — no model scores. */
export interface ContractorEvaluation {
  contractorId: string
  assignedProjects: number
  completedProjects: number
  activeProjects: number
  activeContracts: number
  totalContractValueCr: number
  averageProgressPct: number | null
  /** completed / assigned × 100; null when nothing assigned */
  completionRatePct: number | null
  projects: {
    id: string
    name: string
    status: string
    progressPct: number
    contractValueCr: number | null
    contractStatus: string | null
  }[]
}

export interface Milestone {
  id: string
  projectId: string
  title: string
  status: MilestoneStatus
  plannedStart: string
  plannedEnd: string
  actualStart?: string
  actualEnd?: string
  physicalProgressPct: number
  delayDays?: number
  remarks?: string
  /** project_milestones.planned_progress (the planned % for the milestone). */
  plannedProgressPct?: number
  /** project_milestones.weightage, when recorded. */
  weightage?: number | null
  /** project_milestones.planned_cost / actual_cost (₹ Cr), null when unrecorded. */
  plannedCostCr?: number | null
  actualCostCr?: number | null
}

export interface ProjectFinancials {
  sanctionedAmountCr: number
  revisedAmountCr?: number
  amountUtilizedCr: number
  amountCommittedCr: number
  fundingSources: { source: string; sharePct: number; amountCr: number }[]
  lastTrancheDate?: string
  nextTrancheDueCr?: number
}

export interface Project {
  id: string // e.g. NIR-PWD-2026-0142
  /** Database UUID of the projects row (db.id) — required for writes keyed by UUID. */
  dbId?: string
  name: string
  department: string
  district: string
  division: string
  category: string
  status: ProjectStatus
  sanctionedAmountCr: number
  utilizedAmountCr: number
  physicalProgressPct: number
  financialProgressPct: number
  adminApprovalDate: string
  technicalApprovalDate: string
  expectedCompletion: string
  actualCompletion?: string
  contractor?: string
  riskLevel: 'low' | 'medium' | 'high'
  delayDays: number
  workOrderNo?: string
  summary: string
  financials: ProjectFinancials
  milestones: Milestone[]
  inspectionsCount: number
  openComplaints: number
  pendingApprovals: number
  documentsCount: number
}

export interface ApprovalAction {
  timestamp: string
  actor: string
  role: string
  action: string
  remarks: string
}

export interface ApprovalItem {
  id: string
  type: string // e.g. Administrative Approval, Fund Release, Technical Sanction
  projectId: string
  projectName: string
  submittedBy: string
  submittedOn: string
  amountCr?: number
  status: ApprovalStatus
  slaDueDate: string
  assignedTo: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  auditTrail: ApprovalAction[]
}

export interface TenderLot {
  /** Database UUID of the tender_bids row — required for evaluate/award calls. */
  bidId?: string
  bidder: string
  quotedAmountCr: number
  technicalScore: number
  financialScore: number
  bidValidityDays: number
  bidStatus: 'accepted' | 'rejected' | 'under_review'
}

export interface Tender {
  id: string // eNIT / Tender No.
  /** Database UUID of the tenders row — required for close/award/evaluate calls. */
  databaseId?: string
  title: string
  department: string
  district: string
  status: TenderStatus
  estimatedCostCr: number
  publishedOn: string
  submissionDeadline: string
  openingDate: string
  bidsReceived: number
  lots?: TenderLot[]
  awardedTo?: string
  awardedAmountCr?: number
  category: string
  mode: 'e-Tender' | 'Manually' | 'Global'
  /** Project workspace linkage — undefined for department-wide tenders. */
  projectId?: string
}

export interface BillItem {
  id: string // BILL-2026-0342
  projectId: string
  contractor: string
  /** Contractor's own invoice number */
  billNo: string
  type: 'RA Bill' | 'Final Bill' | 'Material Bill' | 'Labour Bill' | 'Financial Update'
  amountCr: number
  submittedOn: string
  /** e-MB entry the bill claims against */
  mbEntry: string
  status: 'submitted' | 'verified' | 'approved' | 'paid' | 'returned'
  verifiedBy?: string
  approvedBy?: string
  paidOn?: string
  /** Duplicate/abnormal detection flag (AI-assisted, officer reviews) */
  flag?: 'duplicate' | 'abnormal'
  flagNote?: string
}

export interface Grievance {
  id: string // GRV-MH-9942
  /** Database UUID of the complaints row — required for writes keyed by UUID. */
  dbId?: string
  /** Citizen-facing reference number (complaints.reference_number), when present. */
  referenceNumber?: string
  subject: string
  category: string
  projectId?: string
  district: string
  status: GrievanceStatus
  submittedOn: string
  submittedBy: string // masked for internal view per privacy rules
  slaDeadline: string
  assignedTo: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  description: string
  timeline: { timestamp: string; actor: string; action: string; note: string }[]
  attachments: number
  resolutionNote?: string
}

export interface FundFlow {
  id: string
  /** Derived from the latest financial_updates observation date; null when undated */
  fy: string | null
  /** No demand-number column exists in financial_updates — always null */
  demandNo: number | null
  head: string
  budgetEstimateCr: number
  revisedEstimateCr: number
  allocationCr: number
  /** No released-amount column exists in financial_updates — always null */
  releasedCr: number | null
  utilizedCr: number
  status: 'allocated' | 'released' | 'pending'
}

export interface AuditFinding {
  id: string
  auditTitle: string
  projectId?: string
  severity: AuditSeverity
  category: string
  observation: string
  raisedOn: string
  status: 'open' | 'response_received' | 'corrective_action' | 'closed'
  accountableOfficer: string
  dueDate: string
  irregularityAmountCr?: number
}

export interface AlertItem {
  id: string
  category: string
  severity: AlertSeverity
  title: string
  body: string
  timestamp: string
  projectId?: string
  read: boolean
  sourceModule: string
}

export interface DocumentItem {
  id: string
  name: string
  category:
    | 'Administrative Approval'
    | 'Technical Approval'
    | 'Work Order'
    | 'Tender Document'
    | 'Contract Agreement'
    | 'Inspection Report'
    | 'Financial Record'
    | 'Site Photograph'
  projectId?: string
  /** project_documents.document_date, falling back to the row's created_at date; null when neither exists. */
  uploadedOn: string | null
  /** project_documents.publisher, or the uploader's profile name; null when neither is recorded. */
  uploadedBy: string | null
  /** project_documents has no file-size column — always null; pages render "—". */
  fileSizeKb: number | null
  /** project_documents has no version column — always null; pages render "—". */
  version: number | null
  /** Real storage reference (project_documents.storage_path), when the row has one. */
  storagePath: string | null
  /** Real external link (project_documents.external_url), when the row has one. */
  externalUrl: string | null
  expiryDate?: string
  accessLevel: 'Public' | 'Internal' | 'Restricted'
  signedBy?: string
}

/**
 * One budget head for a project, grouped from its real financial_updates
 * rows (group key = the head named in the row's notes). Amounts are the
 * latest recorded values in the group — financial_updates stores cumulative
 * snapshots, so nothing is summed or derived as a fraction.
 */
export interface BudgetHead {
  id: string
  head: string
  originalCr: number
  revisedCr?: number
  utilizedCr: number
}

/** One month of recorded spend: the latest cumulative amount_spent_inr_crore
 * observed in that month, from real financial_updates rows. */
export interface MonthlySpend {
  month: string
  cumulativeCr: number
}

/**
 * A real progress_updates row for one project, with its contractor
 * organisation, milestone name and progress_evidence summary. Geo-tag is
 * the first evidence row that carries coordinates — null when no evidence
 * records a location (never invented).
 */
export interface SiteProgressUpdate {
  id: string
  date: string
  activity: string
  location: string | null
  progressPct: number
  verifiedProgressPct: number | null
  contractor: string | null
  submittedBy: string | null
  geoTag: { lat: number; lng: number } | null
  photos: number
  status: 'verified' | 'pending' | 'rejected' | 'clarification'
  verificationNote?: string
}

/** A real audit_logs row scoped to one project (entity_id = project UUID). */
export interface ProjectActivityEntry {
  id: string
  timestamp: string
  actor: string
  role: string
  action: string
  field: string
  oldValue: string
  newValue: string
}

export interface LitigationCase {
  id: string
  title: string
  court: string
  caseNo: string
  status: LitigationStatus
  filedOn: string
  nextHearing?: string
  projectId?: string
  contractor?: string
  claimAmountCr?: number
  counsel: string
  summary: string
}

export interface WorkOrder {
  id: string
  projectId: string
  /** contracts.contractor_organization_id → organizations.name; null when unreadable */
  contractor: string | null
  issuedOn: string
  valueCr: number
  /** Derived from the contract's scheduled start/completion dates; null when either is absent */
  completionPeriodDays: number | null
  status: 'issued' | 'accepted' | 'in_execution' | 'suspended' | 'closed'
  measurementBookNo: string | null
  /** No defect-liability column exists on contracts — always null */
  defectLiabilityMonths: number | null
}

export interface InspectionRecord {
  id: string
  projectId: string
  inspectedOn: string
  /** profiles.full_name for inspections.inspector_id; null when no profile is recorded */
  inspector: string | null
  type: 'Routine' | 'Surprise' | 'Quality' | 'Safety' | 'Financial'
  findings: string
  /** From inspection_findings latitude/longitude; null when no finding carries coordinates */
  geoTag: { lat: number; lng: number } | null
  /** Count of inspection_findings rows with an evidence_path for this inspection */
  photosCount: number
  outcome: 'satisfactory' | 'observations' | 'non_compliance'
  correctiveAction?: string
}

export interface AiInsight {
  id: string
  /** Raw ai_insights.insight_type as stored — never relabelled */
  area: string
  title: string
  insight: string
  supportingData: string
  /** ai_insights.confidence × 100 as stored; null when the row stores none */
  confidencePct: number | null
  confidenceBand: 'low' | 'medium' | 'high' | null
  recommendedAction: string
  relatedProjectIds: string[]
  generatedOn: string
  /** Distinguishes AI-generated insight from verified data / officer decision */
  classification: 'ai_insight' | 'verified_data' | 'officer_decision'
  /** ai_insights.severity as stored (e.g. LOW / MEDIUM / HIGH / CRITICAL) */
  severity?: string
  /** ai_insights.risk_score as stored; null when absent */
  riskScore?: number | null
  /** ai_insights.evidence entries, stringified */
  evidenceItems?: string[]
  /** ai_insights.recommended_actions entries */
  actionItems?: string[]
  /** ai_insights.details breakdown (schedule / finance / environment), when stored */
  details?: Record<string, unknown> | null
}

export interface CitizenProjectSummary {
  id: string
  name: string
  department: string
  district: string
  status: ProjectStatus
  sanctionedAmountCr: number
  physicalProgressPct: number
  expectedCompletion: string
  contractor: string
  scope: string
  /** Public-facing only: excludes internal notes, officer remarks, sensitive files */
  publicMilestones: { title: string; status: MilestoneStatus; plannedEnd: string }[]
}

export interface Officer {
  id: string
  name: string
  designation: string
  department: string
  employeeNo: string
  roles: string[]
}

/* ---------- Pagination / API envelopes ---------- */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListQuery {
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string[]>
}
