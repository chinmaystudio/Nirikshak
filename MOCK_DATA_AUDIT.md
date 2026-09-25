# NIRIKSHAK — Mock Data Audit Report

**Date:** 2026-09-26  
**Auditor:** Principal Backend Architect & Senior Full-Stack Engineer  
**System Scope:** Government Portal, Contractor Portal, Citizen / User Portal  

---

## 1. Executive Summary

A comprehensive scan across all three NIRIKSHAK frontend interfaces was performed to identify static fixtures, simulated delays, hardcoded mock arrays, and in-memory mock API layers. This audit maps every consumer and exported dataset directly to its authoritative Supabase PostgreSQL table and outlines the non-breaking migration strategy.

---

## 2. Inventory of Mock Datasets & Consumer Mapping

### A. Government Portal (`frontend/government`)

| File | Exported Variable(s) | Consumers / Pages | Target Database Table | Migration Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `src/data/projects.ts` | `PROJECTS`, `PORTFOLIO_STATS` | `ProjectsListPage`, `DashboardPage`, `WorkspaceOverviewPage`, `ReportsPage`, `mockApi.ts` | `projects`, `government_project_summary_view` | Swap `projectsApi.list()` & `projectsApi.getById()` in `src/api/` with Supabase client query. |
| `src/data/modules.ts` | `CONTRACTORS` | `WorkspaceContractorsPage`, `WorkspaceContractorEvalPage`, `ReportsPage` | `organizations` (type = 'contractor'), `project_organizations` | Query `organizations` joining `contracts` and `project_organizations`. |
| `src/data/modules.ts` | `GRIEVANCES` | `GrievancesPage`, `WorkspaceComplaintsPage` | `complaints`, `complaint_updates` | Query `complaints` joined with `complaint_evidence`. |
| `src/data/modules.ts` | `TENDERS` | `WorkspaceTendersPage`, `PlanningPage` | `tenders`, `tender_bids` | Query `tenders` filtered by `project_id`. |
| `src/data/modules.ts` | `AUDIT_LOGS` | `AuditPage`, `WorkspaceAuditPage` | `audit_logs` | Fetch real tamper-evident logs from `audit_logs`. |
| `src/data/modules.ts` | `CITIZEN_GEO` | `CitizenNearbyPage`, `ProjectsListPage` | `projects` (latitude, longitude) | Replace hardcoded geo coordinates with real `latitude` / `longitude` from `projects`. |
| `src/data/workspace.ts`| `BUDGET_HEADS`, `PROJECT_WORKSPACES` | `WorkspaceBudgetPage`, `WorkspaceOverviewPage` | `financial_updates`, `projects` | Derive budget allocations and spend curves from `financial_updates`. |
| `src/data/workspace.ts`| `MILESTONE_META` | `WorkspaceMilestonesPage`, `WorkspaceExecutionPage` | `project_milestones` | Fetch official milestones from `project_milestones` ordered by `display_order`. |
| `src/data/alerts.ts` | `ALERTS` | `AlertsPage`, `WorkspaceAlertsPage`, `NotificationDrawer`, `TopNav` | `notifications`, `delay_events` | Subscribe via Supabase Realtime to `notifications` where `user_id = auth.uid()`. |
| `src/data/approvals.ts`| `APPROVALS` | `ApprovalsPage`, `ApprovalOverviewPage`, `ApprovalProjectPage` | `progress_updates`, `contracts`, `tenders` | Query pending `progress_updates` (status = 'SUBMITTED') and contracts. |
| `src/api/mockApi.ts` | `mockApi` object | `src/api/index.ts` | Complete Supabase Data API | Re-implement methods with Supabase PostgREST client while keeping exact TypeScript signatures. |

---

### B. Contractor Portal (`frontend/contractor`)

| File | Exported Variable(s) | Consumers / Pages | Target Database Table | Migration Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `src/lib/data.ts` | `PROJECTS` | `Dashboard`, `Projects`, `ProjectLayout`, `Details`, `store.tsx` | `projects`, `project_organizations`, `contracts` | Fetch only projects assigned to contractor's organization via `belongs_to_organization()`. |
| `src/lib/data.ts` | `INITIAL_REPORTS` | `ReportUpdate`, `Analytics`, `Details` | `progress_updates`, `progress_evidence` | Replace local array mutations with Supabase `progress_updates` INSERT + storage upload. |
| `src/lib/data.ts` | `INITIAL_BIDS`, `TENDERS` | `Tenders`, `TenderDetails`, `BidSubmission`, `BidAIAssist` | `tenders`, `tender_bids` | Load public/invited tenders and insert bids into `tender_bids`. |
| `src/lib/data.ts` | `INITIAL_INVOICES`, `BILLS` | `Bills`, `Finance` | `financial_updates`, `project_documents` | Fetch bill records and link invoices to Supabase Storage. |
| `src/lib/data.ts` | `INITIAL_NOTIFICATIONS` | `Notifications`, `Header` | `notifications` | Fetch from `notifications` table and subscribe via Realtime. |
| `src/lib/data.ts` | `INSPECTIONS` | `Inspection` | `inspections`, `inspection_findings` | Fetch government inspections scheduled for contractor's project. |

---

### C. Citizen / User Portal (`frontend/user`)

| File | Exported Variable(s) | Consumers / Pages | Target Database Table | Migration Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `src/data/projects.ts` | `PROJECTS` | `HomePage`, `NearbyProjectsPage`, `ProjectDetailsPage`, `projectsService.ts` | `public_projects_view`, `projects` (is_public = true) | Replace mock array with `projectsService.getProjects()` calling `public_projects_view`. |
| `src/data/complaints.ts` | `COMPLAINTS` | `MyComplaintsPage`, `ComplaintDetailsPage`, `complaintsService.ts` | `complaints`, `complaint_evidence`, `complaint_updates` | Replace simulated local state with `complaints` INSERT & SELECT by user_id or reference number. |
| `src/data/alerts.ts` | `ALERTS` | `AlertsPage`, `AlertDetailsPage`, `alertsService.ts` | `notifications`, `delay_events` | Fetch public safety & road disruption advisories. |
| `src/data/community.ts` | `COMMUNITY_ISSUES` | `CommunityPage`, `CommunityIssueDetailsPage`, `communityService.ts` | `complaints` (public issues), `complaint_updates` | Public community civic issues view and upvotes. |
| `src/data/infrastructure.ts`| `INFRASTRUCTURE_DATA` | `IdentifyInfrastructurePage`, `VisionResultPage`, `visionService.ts` | `projects`, `environmental_observations` | Match camera scan GPS/tags against real infrastructure projects in PostgreSQL. |
| `src/landing/data/platformFeatures.ts` | `LIFECYCLE_STAGES`, `AI_ENGINES` | `LandingPage`, `LifecycleSection`, `AIIntelligenceSection` | Static metadata / `ai_insights` | Preserve educational platform schema; dynamic counts fed from Supabase. |

---

## 3. Phased Deprecation & Migration Sequence

```text
[Phase 1] Database Migrations & Seeding (Workbook → Supabase)
               │
               ▼
[Phase 2] Core Service Layer (`src/core/supabase/` & typed client)
               │
               ▼
[Phase 3] Government Portal API Swap (`src/api/index.ts` → Supabase)
               │
               ▼
[Phase 4] Citizen Portal Service Swap (`src/services/` → Supabase)
               │
               ▼
[Phase 5] Contractor Portal Store Swap (`src/lib/store.tsx` → Supabase)
               │
               ▼
[Phase 6] Verification & Decommission of Old Mock Files
```

- **Environment Gate:**
  - `VITE_USE_MOCK_API=false`: Direct queries to Supabase.
  - `VITE_USE_MOCK_API=true`: Development fallback only until live testing completes.
- **Safety Rule:** No mock data file will be deleted until every consumer page has successfully verified end-to-end data fetching, loading spinners, empty states, and error handling with Supabase.
