# NIRIKSHAK PLATFORM — COMPREHENSIVE SECURITY AUDIT REPORT

**Date:** 2026-09-27  
**Repository:** `chinmaystudio/Nirikshak`  
**Classification:** Confidential — Security Assessment  
**Auditor:** Principal Cybersecurity & Application Security Architect  

---

## 1. Executive Summary

A comprehensive, defense-in-depth security audit and attack simulation was conducted on the **NIRIKSHAK** platform across all three stakeholder portals (`/government`, `/contractor`, `/user`), its backend REST services, Supabase PostgreSQL database (Auth, RLS, RPCs, Storage, Realtime), and external AI integrations (OpenRouter / NVIDIA Nemotron).

Every identified vulnerability has been categorized, patched, and verified against an automated regression attack suite.

---

## 2. Vulnerability Findings & Remediation Register

### Finding SEC-001: Client Privilege Escalation via User Metadata Role
- **ID:** SEC-001
- **Severity:** CRITICAL
- **Category:** Broken Authentication & Authorization (CWE-287 / OWASP A01:2021)
- **Affected File:** `frontend/src/core/auth/auth.service.ts`
- **Affected Function:** `AuthService.signUp()`
- **Attack Scenario:** An attacker creates an account via the public signup endpoint supplying `options: { data: { role: 'government_admin' } }` or `role: 'contractor'`. If the system trusts `user_metadata.role` or allows the client to dictate its role, the attacker achieves instant administrative access.
- **Impact:** Complete compromise of Government administrative functions and unauthorized access to classified infrastructure tenders.
- **Fix:** Removed all client role selection parameters from `AuthService.signUp()`. Stripped `role`, `organization_id`, and `is_admin` from metadata before calling `auth.signUp()`. Enforced that all public signups default strictly to `citizen`. Government and Contractor registrations must submit requests through dedicated database workflows (`government_access_requests` and `contractor_access_requests`) requiring out-of-band administrative approval.
- **Test:** Automated test in `backend/tests/security-suite.ts` verifying that metadata roles are not recognized, and verified in `025_complete_security_hardening.sql`.
- **Status:** **RESOLVED**

---

### Finding SEC-002: Direct Manipulation of Tenant Membership Table
- **ID:** SEC-002
- **Severity:** CRITICAL
- **Category:** Broken Object Level Authorization & Privilege Escalation (CWE-284)
- **Affected File:** `backend/supabase/migrations/025_complete_security_hardening.sql`
- **Affected Function:** `organization_members` RLS policies
- **Attack Scenario:** A malicious authenticated citizen executes `supabase.from('organization_members').insert({ organization_id: 'govt-uuid', role: 'government_admin', status: 'active' })`, granting themselves membership in Pune Infrastructure Monitoring Authority.
- **Impact:** Multi-tenant boundary collapse; unauthorized access to competitor or municipal data.
- **Fix:** Dropped all permissive client INSERT, UPDATE, and DELETE policies on `public.organization_members`. Enforced strict default-deny. All membership creation and updates can now only be performed by authorized `SECURITY DEFINER` procedures (`approve_government_access_request`, `approve_contractor_access_request`) running with elevated database authority after verifying officer credentials.
- **Test:** Automated test asserting that direct client INSERT into `organization_members` fails with RLS error or access violation.
- **Status:** **RESOLVED**

---

### Finding SEC-003: Unrestricted Search Path in SECURITY DEFINER Functions
- **ID:** SEC-003
- **Severity:** HIGH
- **Category:** Privilege Escalation via Search Path Hijacking (CWE-426)
- **Affected File:** `backend/supabase/migrations/025_complete_security_hardening.sql`
- **Affected Function:** Multiple PostgreSQL stored functions (`approve_government_access_request`, `award_contract`, `save_tender_bid`, `submit_progress_update`, `approve_progress_update`, etc.)
- **Attack Scenario:** An attacker creates malicious tables or operators in a public schema. When a `SECURITY DEFINER` function executes with superuser or table-owner privileges without a fixed `search_path`, malicious code in `pg_temp` or another schema is executed with elevated privileges.
- **Impact:** Remote code execution or unauthorized privilege escalation within PostgreSQL.
- **Fix:** Executed `ALTER FUNCTION ... SET search_path = public, pg_temp;` across all stored procedures and helper functions.
- **Test:** Confirmed via PostgreSQL catalog query `SELECT proname, proconfig FROM pg_proc WHERE prosecdef = true`.
- **Status:** **RESOLVED**

---

### Finding SEC-004: Contractor Self-Award and Cross-Tenant Bid Tampering
- **ID:** SEC-004
- **Severity:** CRITICAL
- **Category:** Insecure Direct Object Reference / Business Logic Flaw (CWE-639)
- **Affected File:** `backend/supabase/migrations/025_complete_security_hardening.sql`
- **Affected Function:** `award_contract()` & `save_tender_bid()`
- **Attack Scenario:** A contractor attempts to invoke `award_contract(tender_id, own_bid_id)` directly, or supplies an arbitrary `contractor_organization_id` in `save_tender_bid()` to submit bids on behalf of a competitor.
- **Impact:** Illegitimate contract allocation, fraudulent tender awards, breach of competitor pricing models.
- **Fix:** Rebuilt `award_contract()` to strictly verify that `auth.uid()` belongs to an active government organization managing the project (`can_manage_project(v_project_id)`). Rebuilt `save_tender_bid()` so that `contractor_organization_id` is derived strictly from `organization_members` where `user_id = auth.uid()` and `status = 'active'`. Client cannot specify the organization or author identity.
- **Test:** Verified with multi-tenant mock tests in `backend/tests/security-suite.ts`.
- **Status:** **RESOLVED**

---

### Finding SEC-005: Citizen Public Progress Invariant Violation
- **ID:** SEC-005
- **Severity:** HIGH
- **Category:** Integrity Violation & Data Falsification (CWE-345)
- **Affected File:** `backend/supabase/migrations/025_complete_security_hardening.sql`, `backend/src/routes/progress.ts`
- **Affected Function:** `approve_progress_update()`, `submit_progress_update()`
- **Attack Scenario:** Contractor submits 80% progress on a project where verified progress is 37%. If public citizen dashboards read `progress_updates.reported_progress` rather than verified progress, citizens are deceived about infrastructure delivery status. If a subsequent 80% claim is rejected, the displayed progress must remain 37%.
- **Impact:** Misleading public reporting, loss of civic trust, and concealment of project delays.
- **Fix:** The `projects.physical_progress_percent` column is updated **only** when a Government reviewer explicitly executes `approve_progress_update(..., p_status := 'APPROVED')`. Unverified contractor submissions and rejected submissions never modify `projects.physical_progress_percent`. Citizen views project only from `projects.physical_progress_percent`.
- **Test:** Automated test in `backend/tests/security-suite.ts` verifying that `projects.physical_progress_percent` is untouched during contractor submission and rejection.
- **Status:** **RESOLVED**

---

### Finding SEC-006: Stale LocalStorage Authentication Bypass
- **ID:** SEC-006
- **Severity:** MEDIUM
- **Category:** Session Management / State Desynchronization (CWE-384 / CWE-613)
- **Affected File:** `frontend/src/modules/user/app/providers/store.ts`
- **Affected Function:** `load()` & `persist()`
- **Attack Scenario:** A user logs out or has their session revoked in Supabase Auth, but `nirikshan.ts.v1` in `localStorage` retains the cached user object, allowing client-side routes to render restricted views without a valid token.
- **Impact:** Sensitive user data visible on shared public terminals.
- **Fix:** Modified `store.ts` to explicitly set `user: null` upon `load()` and stripped `user` from the persisted JSON in `localStorage`. Added authoritative `syncCitizenSession()` in `useAuth.ts` and `authService.ts` that triggers re-authentication against Supabase Auth.
- **Test:** Automated test confirming that clearing Supabase session while retaining localStorage forces re-authentication.
- **Status:** **RESOLVED**

---

### Finding SEC-007: Unauthenticated Access to Privileged Backend Endpoints
- **ID:** SEC-007
- **Severity:** HIGH
- **Category:** Missing Authentication & Authorization (OWASP A01:2021)
- **Affected File:** `backend/src/routes/projects.ts`, `backend/src/routes/progress.ts`, `backend/src/routes/ai.ts`
- **Affected Function:** `POST /api/projects`, `POST /api/progress/submit`, `POST /api/progress/review`, `POST /api/ai/analyze-progress`
- **Attack Scenario:** An anonymous attacker or low-privileged citizen sends HTTP requests directly to backend endpoints without a valid Bearer token, or with a citizen token, attempting to create projects or review progress.
- **Impact:** Unauthorized resource creation, modification of review states, and exhaustion of backend AI credits.
- **Fix:** Implemented `requireAuth`, `requireGovernment`, `requireContractor`, and project access check middlewares in `backend/src/middleware/auth.ts`. Gated all mutation routes accordingly.
- **Test:** Automated test in `backend/tests/security-suite.ts` asserting HTTP 401 for requests without Bearer tokens.
- **Status:** **RESOLVED**

---

### Finding SEC-008: OpenRouter AI Key & Context Privacy Leakage
- **ID:** SEC-008
- **Severity:** HIGH
- **Category:** Sensitive Data Exposure & Fabrication Risk (OWASP A02:2021)
- **Affected File:** `backend/src/ai/provider.ts`
- **Affected Function:** `sanitizeAiContext()`, `analyzeProjectHealth()`
- **Attack Scenario:** Unsanitized citizen complaints, Aadhaar numbers, phone numbers, employee emails, or competitor pricing details are sent to third-party LLMs (OpenRouter / NVIDIA Nemotron). Furthermore, if the AI service fails, fallback code might generate fabricated compliance data.
- **Impact:** Violation of Indian Digital Personal Data Protection Act (DPDPA), commercial confidentiality breaches, and hallucinated regulatory sign-offs.
- **Fix:** Created a recursive `sanitizeAiContext()` utility that redacts JWTs, bearer tokens, passwords, emails, phone numbers, Aadhaar patterns, and confidential bid amounts before transmission. Replaced mock fallbacks with an explicit `throw new Error('AI_ANALYSIS_UNAVAILABLE')` per Rule 62.
- **Test:** Automated test in `backend/tests/security-suite.ts` verifying that sensitive PII and tokens are redacted and that unavailable AI throws clean errors without fabricating data.
- **Status:** **RESOLVED**

---

### Finding SEC-009: Storage Path Traversal and Sensitive Document Exposure
- **ID:** SEC-009
- **Severity:** HIGH
- **Category:** Path Traversal / Broken Access Control (CWE-22 / CWE-73)
- **Affected File:** `backend/supabase/migrations/025_complete_security_hardening.sql`, `backend/src/routes/complaints.ts`
- **Affected Function:** Storage bucket policies & upload path validation
- **Attack Scenario:** An attacker uploads a file with a relative path like `../../etc/passwd` or accesses evidence uploaded by other contractors in private buckets.
- **Impact:** Arbitrary file overwrite or unauthorized disclosure of contractor/government confidential files.
- **Fix:** Configured private storage buckets (`progress-evidence`, `contractor-documents`, `government-documents`, `complaint-evidence`). Added path sanitization rejecting `..`, absolute paths, and leading slashes. Enforced storage RLS policies ensuring contractors only access objects under their assigned project prefixes.
- **Test:** Automated path traversal attack test in `backend/tests/security-suite.ts`.
- **Status:** **RESOLVED**

---

### Finding SEC-010: Cross-Site Scripting (XSS) via Citizen Complaint & Text Fields
- **ID:** SEC-010
- **Severity:** MEDIUM
- **Category:** Stored Cross-Site Scripting (CWE-79)
- **Affected File:** `backend/src/routes/complaints.ts`
- **Affected Function:** `sanitizeText()` in complaint intake
- **Attack Scenario:** An attacker submits a complaint containing `<script>alert(document.cookie)</script>` or `<img src=x onerror=...>`, which is viewed by a municipal government officer in their dashboard.
- **Impact:** Session hijacking of government administrators.
- **Fix:** Implemented `sanitizeText()` stripping all HTML and script tags, converting text to plain sanitized strings. Frontend renders grievance and project descriptions via text nodes rather than `dangerouslySetInnerHTML`.
- **Test:** Automated test in `backend/tests/security-suite.ts` submitting script payloads and asserting complete sanitization.
- **Status:** **RESOLVED**

---

### Finding SEC-011: Open Redirect Vulnerability in Authentication Routing
- **ID:** SEC-011
- **Severity:** MEDIUM
- **Category:** Open Redirect (CWE-601)
- **Affected File:** `frontend/src/core/auth/auth.service.ts`, `frontend/src/core/auth/ProtectedRoute.tsx`
- **Affected Function:** `AuthService.sanitizeRedirectPath()`, `signInWithGoogle()`
- **Attack Scenario:** An attacker crafts a link like `/login?redirectTo=https://evil.com` or `//evil.com` to phish users after legitimate authentication.
- **Impact:** Phishing of government officials and contractors.
- **Fix:** Added `AuthService.sanitizeRedirectPath()` which strips whitespace, null bytes, backslashes (`\`), protocol-relative URLs (`//`), and non-path schemes (`javascript:`, `data:`). Disallows any destination outside the internal origin.
- **Test:** Verified with protocol-relative and backslash test payloads.
- **Status:** **RESOLVED**

---

### Finding SEC-012: Information Disclosure via /health and Error Stack Traces
- **ID:** SEC-012
- **Severity:** LOW
- **Category:** Security Misconfiguration & Information Exposure (CWE-209)
- **Affected File:** `backend/src/index.ts`, `backend/src/middleware/security.ts`
- **Affected Function:** `/health` route & `safeErrorHandler`
- **Attack Scenario:** Attackers probe `/health` or trigger 500 errors to inspect database connection strings, environment variables, internal paths, or library versions.
- **Impact:** Facilitates reconnaissance and targeted exploitation.
- **Fix:** Minimal `/health` returning strictly `{"status": "ok"}`. Safe error handler returns a generic message and unique request correlation ID in production, omitting stack traces and database details.
- **Test:** Automated test asserting `/health` response is strictly `{"status": "ok"}` without extra keys.
- **Status:** **RESOLVED**

---

## 3. Summary of Resolved Vulnerabilities

| Severity | Count Identified | Count Resolved | Residual Count |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | 2 | 2 | **0** |
| **HIGH** | 5 | 5 | **0** |
| **MEDIUM** | 3 | 3 | **0** |
| **LOW** | 2 | 2 | **0** |
| **TOTAL** | **12** | **12** | **0** |

---
*End of Security Audit Report.*
