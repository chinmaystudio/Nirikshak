import { Routes, Route, Navigate } from 'react-router-dom'
import { GovernmentLayout } from '@/layouts/GovernmentLayout'
import { CitizenLayout } from '@/layouts/CitizenLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { NotFoundPage, ErrorPage } from '@/pages/errors/ErrorPages'

/* ---------- Auth screens ---------- */
import { LoginPage } from '@/pages/auth/LoginPage'
import { OtpVerificationPage } from '@/pages/auth/OtpVerificationPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { TwoFactorPage } from '@/pages/auth/TwoFactorPage'
import { SelectDepartmentPage } from '@/pages/auth/SelectDepartmentPage'
import { SelectRolePage } from '@/pages/auth/SelectRolePage'

/* ---------- Government screens ---------- */
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProjectsListPage } from '@/pages/projects/ProjectsListPage'
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage'
import { PlanningPage } from '@/pages/planning/PlanningPage'
import { FinancePage } from '@/pages/finance/FinancePage'
import { TendersPage } from '@/pages/tenders/TendersPage'
import { TenderEvaluationPage } from '@/pages/tenders/TenderEvaluationPage'
import { ContractorsPage } from '@/pages/contractors/ContractorsPage'
import { WorkOrdersPage } from '@/pages/work/WorkOrdersPage'
import { MilestonesPage } from '@/pages/work/MilestonesPage'
import { ApprovalsPage } from '@/pages/approvals/ApprovalsPage'
import { GrievancesPage } from '@/pages/grievances/GrievancesPage'
import { LitigationPage } from '@/pages/litigation/LitigationPage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { AlertsPage } from '@/pages/alerts/AlertsPage'
import { AuditPage } from '@/pages/audit/AuditPage'
import { AiInsightsPage } from '@/pages/ai-insights/AiInsightsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

/* ---------- Citizen screens ---------- */
import { CitizenHomePage } from '@/pages/citizen/CitizenHomePage'
import { CitizenProjectsPage } from '@/pages/citizen/CitizenProjectsPage'
import { CitizenProjectDetailPage } from '@/pages/citizen/CitizenProjectDetailPage'
import { CitizenNearbyPage } from '@/pages/citizen/CitizenNearbyPage'
import { CitizenGrievancePage } from '@/pages/citizen/CitizenGrievancePage'
import { CitizenTrackPage } from '@/pages/citizen/CitizenTrackPage'

/**
 * Full route map (spec). Government routes live under the officer shell;
 * citizen routes are public; auth screens are standalone.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth suite */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/otp-verification" element={<OtpVerificationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="/select-department" element={<SelectDepartmentPage />} />
        <Route path="/select-role" element={<SelectRolePage />} />
      </Route>

      {/* Government (officer) suite */}
      <Route element={<GovernmentLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/create" element={<PlanningPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/tenders" element={<TendersPage />} />
        <Route path="/tenders/:id" element={<TenderEvaluationPage />} />
        <Route path="/contractors" element={<ContractorsPage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/milestones" element={<MilestonesPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/grievances" element={<GrievancesPage />} />
        <Route path="/litigation" element={<LitigationPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/ai-insights" element={<AiInsightsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Citizen (public) suite */}
      <Route path="/citizen" element={<CitizenLayout />}>
        <Route index element={<CitizenHomePage />} />
        <Route path="projects" element={<CitizenProjectsPage />} />
        <Route path="projects/:id" element={<CitizenProjectDetailPage />} />
        <Route path="nearby" element={<CitizenNearbyPage />} />
        <Route path="grievance" element={<CitizenGrievancePage />} />
        <Route path="track" element={<CitizenTrackPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      <Route path="/error" element={<ErrorPage />} />
    </Routes>
  )
}
