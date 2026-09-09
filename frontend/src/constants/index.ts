import type { Department } from '@/types'

/**
 * Static reference data for NIRIKSHAK.
 * All values are realistic Indian government conventions (demo data, no backend).
 */

export const APP_NAME = 'NIRIKSHAK'
export const APP_TAGLINE = 'Transparent Projects • Stronger India'
export const APP_VERSION = '2.4.1'
export const FOOTER_TEXT =
  'System Status: All Ministry Nodes Operational | NIC Gov Cloud Hosted'

export const DEMO_BANNER_KEY = 'common.demoBanner'

/* ---------- Departments (demo master list) ---------- */
export const DEPARTMENTS: Department[] = [
  { id: 'pwd', code: 'PWD', name: 'Public Works Department', nameHi: 'लोक निर्माण विभाग', nameMr: 'लोकमार्ग निर्माण विभाग' },
  { id: 'wrd', code: 'WRD', name: 'Water Resources Department', nameHi: 'जल संसाधन विभाग', nameMr: 'जलसंधारण विभाग' },
  { id: 'uid', code: 'UID', name: 'Urban Development Department', nameHi: 'शहरी विकास विभाग', nameMr: 'नगरविकास विभाग' },
  { id: 'rhd', code: 'RHD', name: 'Rural Development Department', nameHi: 'ग्रामीण विकास विभाग', nameMr: 'ग्रामीण विकास विभाग' },
  { id: 'phed', code: 'PHED', name: 'Public Health Engineering Department', nameHi: 'जन स्वास्थ्य अभियांत्रिकी विभाग', nameMr: 'सार्वजनिक आरोग्य अभियांत्रिकी विभाग' },
  { id: 'med', code: 'MED', name: 'Maharashtra Energy Department', nameHi: 'ऊर्जा विभाग', nameMr: 'ऊर्जा विभाग' },
]

export const DISTRICTS = [
  'Pune', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nashik', 'Thane',
  'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Yavatmal', 'Nanded',
  'Jalgaon', 'Ahmednagar', 'Satara', 'Sangli', 'Ratnagiri', 'Chandrapur',
]

export const DIVISIONS = ['Konkan', 'Pune', 'Nashik', 'Chhatrapati Sambhajinagar', 'Amravati', 'Nagpur']

export const PROJECT_CATEGORIES = [
  'Roads & Highways', 'Water Supply', 'Irrigation', 'Buildings',
  'Urban Infrastructure', 'Bridges', 'Sanitation & Sewerage', 'Energy',
]

/* ---------- Funding sources (typical GoM shared patterns) ---------- */
export const FUNDING_SOURCES = [
  'State Budget (Plan)',
  'CSS — Central Share',
  'Jal Jeevan Mission',
  'AMRUT 2.0',
  'Finance Commission Grant',
  'NABARD RIDF',
  'HUDCO Loan',
  'HUDCO Loan (Interior Parts)',
]

/* ---------- Document categories (spec: 8 fixed) ---------- */
export const DOCUMENT_CATEGORIES = [
  'Administrative Approval',
  'Technical Approval',
  'Work Order',
  'Tender Document',
  'Contract Agreement',
  'Inspection Report',
  'Financial Record',
  'Site Photograph',
] as const

/* ---------- Alert categories (spec: 8 fixed) ---------- */
export const ALERT_CATEGORIES = [
  'SLA Breach',
  'Fund Disbursal',
  'Tender Activity',
  'Quality Flag',
  'Geo-Inspection',
  'Litigation Update',
  'Grievance Escalation',
  'System & Sync',
] as const

/* ---------- Report types (spec: 8 fixed) ---------- */
export const REPORT_TYPES = [
  'Project Status Report',
  'Financial Utilization Report',
  'Physical Progress Report',
  'Contractor Performance Report',
  'Audit Compliance Report',
  'Grievance Redressal Report',
  'Tender & Procurement Report',
  'Executive Summary',
] as const

/* ---------- Government sidebar navigation (preserved Stitch grouping) ---------- */
export interface NavItem {
  /** Route path */
  to: string
  /** i18n key */
  labelKey: string
  /** Material Symbols ligature */
  icon: string
  /** Badge count source — alert-like counts shown beside the label */
  badge?: number
  /** neutral | secondary (Stitch badge semantics) */
  badgeTone?: 'neutral' | 'secondary'
}

export interface NavGroup {
  /** i18n key of the section header */
  titleKey: string
  items: NavItem[]
}

export const GOVERNMENT_NAV: NavGroup[] = [
  {
    titleKey: 'nav.groupCore',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
      { to: '/projects', labelKey: 'nav.projects', icon: 'map' },
      { to: '/planning', labelKey: 'nav.planning', icon: 'add_task' },
    ],
  },
  {
    titleKey: 'nav.groupGovernance',
    items: [
      { to: '/finance', labelKey: 'nav.finance', icon: 'account_balance' },
      { to: '/tenders', labelKey: 'nav.tenders', icon: 'gavel', badge: 4, badgeTone: 'secondary' },
      { to: '/contractors', labelKey: 'nav.contractors', icon: 'engineering' },
      { to: '/work-orders', labelKey: 'nav.workExecution', icon: 'construction' },
      { to: '/milestones', labelKey: 'nav.milestones', icon: 'fact_check', badge: 3, badgeTone: 'neutral' },
    ],
  },
  {
    titleKey: 'nav.groupOversight',
    items: [
      { to: '/approvals', labelKey: 'nav.approvals', icon: 'rule', badge: 7, badgeTone: 'secondary' },
      { to: '/grievances', labelKey: 'nav.grievances', icon: 'report_problem', badge: 4, badgeTone: 'neutral' },
      { to: '/litigation', labelKey: 'nav.litigation', icon: 'policy' },
      { to: '/documents', labelKey: 'nav.documents', icon: 'folder_shared' },
      { to: '/alerts', labelKey: 'nav.alerts', icon: 'crisis_alert', badge: 5, badgeTone: 'secondary' },
      { to: '/audit', labelKey: 'nav.audit', icon: 'content_paste_search' },
      { to: '/ai-insights', labelKey: 'nav.aiInsights', icon: 'auto_awesome' },
      { to: '/reports', labelKey: 'nav.reports', icon: 'analytics' },
    ],
  },
  {
    titleKey: 'nav.groupCitizen',
    items: [
      { to: '/citizen', labelKey: 'nav.citizenPortal', icon: 'public' },
      { to: '/settings', labelKey: 'nav.settings', icon: 'manage_accounts' },
    ],
  },
]

/* ---------- Project detail sub-tabs (spec: 13) ---------- */
export const PROJECT_DETAIL_TABS = [
  'overview',
  'timeline',
  'financials',
  'milestones',
  'workOrder',
  'contractor',
  'inspections',
  'documents',
  'grievances',
  'approvals',
  'litigation',
  'aiInsights',
  'auditTrail',
] as const

export type ProjectDetailTab = (typeof PROJECT_DETAIL_TABS)[number]

/* ---------- Mock API switch (spec: clearly label demo data) ---------- */
export const USE_MOCK_API =
  (import.meta.env.VITE_USE_MOCK_API ?? 'true') !== 'false'
