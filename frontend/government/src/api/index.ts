/**
 * Public API surface used by pages. Today it re-exports the mock API; when a
 * real backend exists, swap the implementations here (same signatures) and no
 * page code changes.
 */
export {
  authApi,
  projectsApi,
  contractorsApi,
  approvalsApi,
  tendersApi,
  grievancesApi,
  financeApi,
  auditApi,
  alertsApi,
  documentsApi,
  litigationApi,
  workApi,
  insightsApi,
  citizenApi,
} from './mockApi'
