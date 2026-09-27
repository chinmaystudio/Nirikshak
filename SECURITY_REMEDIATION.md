# NIRIKSHAK PLATFORM — SECURITY REMEDIATION SPECIFICATION

**Document Version:** 1.0.0  
**Status:** IMPLEMENTED & VERIFIED  
**Audience:** Security Engineers, DevOps, Platform Architects  

---

## 1. Architectural Architecture & Scope of Remediations

This document records the exact technical remediation architecture applied to eliminate security weaknesses in the NIRIKSHAK multi-tenant infrastructure monitoring platform.

```
                           SUPABASE AUTH
                                │
                                ▼
                            auth.uid()
                                │
                                ▼
                       organization_members
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             GOVERNMENT ORG            CONTRACTOR ORG
               shared tenant             isolated tenant
                    │                       │
                    └───────────┬───────────┘
                                ▼
                               RLS
                                │
                          PostgreSQL
                                │
                  ┌─────────────┼──────────────┐
                  ▼             ▼              ▼
             Government      Contractor      Citizen
              internal         scoped       verified public
                                │
                                ▼
                            Backend
                             Render
                                │
                  privileged workflows only
                                │
                                ▼
                              AI
                      OpenRouter / Nemotron
```

---

## 2. Remediation Details by System Layer

### 2.1 Database & Row Level Security (RLS)
- **Migration:** `backend/supabase/migrations/025_complete_security_hardening.sql`
- **Default Deny Policy:** Enabled on all core tables: `projects`, `organizations`, `organization_members`, `government_access_requests`, `contractor_access_requests`, `tenders`, `tender_bids`, `contracts`, `progress_updates`, `progress_evidence`, `complaints`, `complaint_updates`, `notifications`, `audit_logs`, and `storage.objects`.
- **Authoritative Security Helpers:**
  - `get_current_user_role()`: Extracts the verified active role from `organization_members` for `auth.uid()`.
  - `get_current_user_organization_id()`: Derives the active tenant organization ID.
  - `is_government_user()` / `is_contractor_user()` / `is_citizen()`: Role verification functions with guaranteed search paths.
  - `can_access_project(p_id)`: Verifies access based on Government organization ownership, contractor assignment via `project_organizations`, or public visibility.
  - `can_manage_project(p_id)`: Enforces Government authority scoping.
  - `can_review_progress(p_id)`: Authorizes progress approval rights.
- **Search Path Isolation:** Configured `SET search_path = public, pg_temp;` on all `SECURITY DEFINER` functions to mitigate CWE-426 search-path hijacking attacks.

### 2.2 Workflow Integrity & Atomic RPCs
- **`save_tender_bid()`**:
  - Automatically derives `auth.uid()` and contractor organization ID from the database session.
  - Generates secure `BID-YYYYMMDD-HEX` bid references on the server.
  - Verifies that the tender is in `PUBLISHED` status and that the deadline has not expired.
  - Enforces bid confidentiality: contractors can only inspect and modify their own bids; competing bid amounts and proposals are never exposed.
- **`award_contract()`**:
  - Implemented as an atomic, row-locking transaction (`SELECT FOR UPDATE`).
  - Verifies that the acting officer belongs to the Government organization governing the project.
  - Updates the selected bid to `SELECTED`, marks competing bids as `REJECTED`, marks the tender as `AWARDED`, generates a contract record, creates project contractor assignment, emits an immutable audit log, and notifies the contractor.
  - Strictly prevents contractor self-awards or out-of-turn execution.
- **`submit_progress_update()`**:
  - Authorizes submissions exclusively from contractors assigned to the project.
  - Validates that milestones belong to the referenced project and that progress values are within `[0, 100]`.
  - Asynchronously schedules AI inspection jobs in `ai_jobs`.
- **`approve_progress_update()`**:
  - Accepts review statuses: `APPROVED`, `REJECTED`, `CLARIFICATION_REQUIRED`.
  - Only when `p_status = 'APPROVED'` is the verified progress written to `projects.physical_progress_percent`.
  - Rejections preserve the prior verified progress, satisfying the Citizen Progress Invariant (Rule 29).

### 2.3 Storage Hardening
- **Bucket Creation & Isolation:**
  - `progress-evidence` (Private)
  - `contractor-documents` (Private)
  - `government-documents` (Private)
  - `complaint-evidence` (Private)
  - `public-documents` (Public read-only)
- **Object Access Policies:** Enforced strict RLS on `storage.objects` using project ID prefix validation (`projects/<project_id>/...`).
- **Path Sanitization:** Reject path traversal characters (`..`, `/`, `\`) and normalize file names using cryptographic UUIDs.

### 2.4 Backend Service-Role Boundary & Middleware
- **Client Factory (`backend/src/services/supabase.ts`):** `createAuthenticatedClient` uses the Supabase Anonymous Key combined with the caller's verified Bearer JWT, ensuring all standard CRUD requests run through Postgres RLS. The `supabaseAdmin` service-role client is reserved strictly for system tasks and AI background workers.
- **Middleware Suite (`backend/src/middleware/auth.ts`):**
  - `requireAuth`: Validates caller JWT with `supabase.auth.getUser()`, resolves active membership, tenant organization ID, and role.
  - `requireGovernment` / `requireContractor`: Enforces role-based gates.
  - `requireGovernmentProjectAccess`: Ensures government officers only access projects under their jurisdiction.
  - `requireContractorProjectAccess`: Ensures contractors only access assigned projects.
- **Security Middlewares (`backend/src/middleware/security.ts`):**
  - CORS allowlist permitting only production Vercel frontend, custom production domains, and localhost.
  - Rate limiting (sliding window/token bucket) to protect sensitive auth, complaint, upload, and AI routes.
  - Standard HTTP security headers (`CSP`, `HSTS`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
  - 2MB body parser limits to prevent memory exhaustion attacks.
  - Sanitized global error handler returning request correlation IDs without leaking internal stack traces or database errors.

### 2.5 AI Security & Privacy
- **Provider Architecture (`backend/src/ai/provider.ts`):**
  - Calls to OpenRouter / NVIDIA Nemotron are restricted to the backend service. No AI API keys or endpoints are accessible to the frontend.
  - **Context Sanitizer (`sanitizeAiContext`):** Automatically redacts emails, telephone numbers, Aadhaar numbers, Bearer tokens, private keys, passwords, and competitor bid payloads.
  - **Fallback Security:** Completely disabled fabricated or simulated mock fallback outputs. If the AI model or API fails, the backend throws an explicit `AI_ANALYSIS_UNAVAILABLE` error (Rule 62).
  - **Structured Validation:** LLM responses are parsed and verified using Zod schemas with a single automatic retry on malformed JSON.
  - **Safe Audit Logging:** Prompts and raw PII are never logged; only metadata (job ID, token counts, latency, status) is recorded.

### 2.6 Frontend Session & State Hardening
- **Role Stripping (`frontend/src/core/auth/auth.service.ts`):** Public signups default strictly to `citizen`. Injected metadata roles (`government_admin`, `contractor`) are explicitly deleted.
- **Session Cleanup (`frontend/src/core/auth/AuthProvider.tsx`):** `logout()` disconnects all Supabase Realtime subscriptions, clears `sessionStorage`, and flushes query caches.
- **LocalStorage Disarmament (`frontend/src/modules/user/app/providers/store.ts`):** User state is never loaded from or persisted to `localStorage` (`nirikshan.ts.v1`). All citizen sessions are verified against Supabase Auth.
- **Open Redirect Guard:** `AuthService.sanitizeRedirectPath()` sanitizes redirect destinations, blocking external domains, protocol-relative paths (`//`), backslash bypasses (`/\`), and script protocols.

---
*End of Security Remediation Specification.*
