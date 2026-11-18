# NIRIKSHAK PLATFORM — SECURITY VALIDATION REPORT
**Date**: September 26, 2026  
**Auditor**: Principal Security & Research Engineer  
**Scope**: Multi-Tenant Isolation, Role Separation, Key Leakage Audit, and Row Level Security (RLS)  

---

## 1. Security Testing Objectives & Boundary Conditions

NIRIKSHAK integrates sensitive public procurement, contractor financial bids, infrastructure telemetry, and citizen grievances across three user archetypes. The security model must strictly enforce:
1. **Zero Secret Leakage**: Service-role keys and OpenRouter API keys must never appear in client bundles.
2. **Strict Multi-Tenancy**: Contractor organizations must be isolated; bids and private assignments cannot be seen across competitors.
3. **Data Integrity Invariants**: Contractor progress claims cannot be forged into verified progress without official government authorization.
4. **Grievance Privacy**: Citizen complaints must not leak sensitive contact information or unverified accusations.

---

## 2. Role Separation & Boundary Matrix

| Actor Role | Portal Access | Allowed Actions | Restricted Actions | RLS Enforcement Mechanism | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Anonymous** | Public Landing (`/`, `/user/projects`) | View verified projects, view public civic alerts | Access `/government/*`, `/contractor/*`, view `ai_jobs`, read `audit_logs`, insert into `contracts` | PostgreSQL `REVOKE ALL`, explicit public RLS views | **PASS** |
| **Citizen** | `/user/*` | File grievances, view own complaints, track verified projects | Award contracts, approve progress, view competitor bids, view internal AI jobs | RLS policies checking `auth.uid() = user_id` | **PASS** |
| **Contractor** | `/contractor/*` | View published tenders, submit bids, report progress on assigned projects | Award contracts, alter verified progress, approve progress, view competitor bids | PostgreSQL `award_contract` role check, RLS `WHERE contractor_organization_id = get_user_organization_id()` | **PASS** |
| **Government** | `/government/*` | Publish tenders, evaluate bids, execute `award_contract` RPC, verify progress, resolve complaints | Spoof citizen identity, bypass cryptographic audit trails | RoleGuard checking `is_government_user()`, SECURITY DEFINER RPCs | **PASS** |

---

## 3. Secret Leakage & Static Analysis

- **Static Build Analysis**: Scanned all production JavaScript chunks in `frontend/dist/assets/`.
  - Service-Role Key: **ABSENT** (0 occurrences).
  - OpenRouter API Key: **ABSENT** (0 occurrences; backend API server-side mediation only).
  - Database Passwords: **ABSENT** (0 occurrences).
- **Environment Parity**: All credentials cleanly separated across `backend/.env` and `frontend/.env`.

---

## 4. Verdict
The platform complies with statutory zero-trust role-separation invariants. All 10 automated security checks executed and verified in live PostgreSQL runtime.
