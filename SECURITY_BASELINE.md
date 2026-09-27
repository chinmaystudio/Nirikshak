# NIRIKSHAK Security Baseline

## Baseline Overview
* **Timestamp**: 2026-09-27T22:54:00+05:30
* **Starting Commit SHA**: `9018216b9476a52e3c8ea650feb75228912e45fd`
* **Branch**: `main`
* **Repository**: `chinmaystudio/Nirikshak`

---

## 1. Build & Typecheck Baseline

### Frontend (`/frontend`)
* **`npm ci` / dependencies**: Clean install.
* **`npm run build`**: PASS (`vite v5.4.21`, built in 32.77s).
* **`npm run typecheck`**: **FAILING (Pre-existing)**
  * `src/modules/government/pages/access-requests/AccessRequestsPage.tsx`:
    * Argument `"contractor_access_requests"` and `"government_access_requests"` missing in generated Supabase TypeScript database schema (`types.ts`).
    * Argument `"approve_government_access_request"`, `"approve_contractor_access_request"`, `"reject_access_request"` missing from RPC definitions in `types.ts`.
    * Property `'title'` missing on `<Panel>` component invocations (lines 404, 515).
  * `src/modules/government/pages/approval/ApprovalOverviewPage.tsx` and `WorkspaceApprovalsPage.tsx`:
    * Property `'approve'` and `'reject'` missing from `approvalsApi` interface.
  * `src/modules/government/pages/dashboard/DashboardPage.tsx`:
    * Query on `"government_access_requests"` untyped in `types.ts`.
* **`npm test`**: No test script defined in `package.json`.

### Backend (`/backend`)
* **`npm ci` / dependencies**: Clean install.
* **`npm run typecheck`**: **PASS** (`tsc --noEmit`, exit code 0).
* **`npm run build`**: **PASS** (`tsc`, exit code 0).
* **`npm test`**: No test script defined in `package.json`.

---

## 2. Dependency Vulnerability Audit (`npm audit`)

### Frontend
* **Findings**: 4 vulnerabilities (3 Moderate, 1 High)
  1. `esbuild <=0.24.2` (GHSA-67mh-4wv8-2f99) - Moderate: Dev server requests allowed from any website.
  2. `vite <=6.4.2` - Moderate (via esbuild dependency).
  3. `react-router 6.0.0 - 7.17.0` (GHSA-wrjc-x8rr-h8h6) - Moderate: Open redirect via backslash in `<Link>` / `useNavigate`.
  4. `react-router 6.0.0 - 7.17.0` (GHSA-337j-9hxr-rhxg) - High: Arbitrary Constructor Injection via `deserializeErrors()`.

### Backend
* **Findings**: 0 vulnerabilities found (`npm audit` clean).

---

## 3. Database & Supabase Migrations
* **Applied Migrations in Supabase**:
  * `20260925222223_001_extensions`
  * `20260925222344_002_profiles`
  * `20260925222349_003_organizations`
  * `20260925222355_004_projects`
  * `20260925222401_005_tenders`
  * `20260925222406_006_contracts`
  * `20260925222410_007_milestones`
  * `20260925222415_008_progress`
  * `20260925222421_009_complaints`
  * `20260925222427_010_inspections`
  * `20260925222432_011_finance`
  * `20260925222438_012_environment`
  * `20260925222442_013_documents`
  * `20260925222446_014_notifications`
  * `20260925222451_015_ai`
  * `20260925222457_016_audit`
  * `20260925222509_017_rls`
  * `20260925222521_018_indexes`
  * `20260926111150_020_secure_workflows`
* **Additional DB State**:
  * Multi-tenant architecture & clearance RPCs from `024_multi_tenant_gov_contractor_architecture.sql` deployed and active in PostgreSQL.
  * Foreign key constraints `fk_gov_req_profiles` and `fk_contractor_req_profiles` added to resolve PostgREST embedding relationships.

---

## 4. Deployment Configuration
* **Frontend**: Vercel SPA (`frontend/vercel.json`), deployment at `https://nirikshak-portal.vercel.app`. Currently missing HTTP security headers.
* **Backend**: Render Web Service (`render.yaml`), service `nirikshak-backend`, health check path `/health`.
* **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`, `deploy.yml`, `.github/dependabot.yml`). Currently lacks automated security scanning, RLS testing, and tenant attack verification.

---

## 5. Security-Critical Inventory
* **Authentication**: `frontend/src/core/auth/auth.service.ts`, `frontend/src/core/auth/AuthProvider.tsx`, `frontend/src/core/auth/RoleGuard.tsx`
* **Backend API**: `backend/src/index.ts`, backend controllers, Express middleware
* **AI Analysis Pipeline**: OpenRouter integration, NVIDIA Nemotron model configuration
* **Storage & Realtime**: Supabase Storage buckets, Supabase Realtime channel subscriptions
