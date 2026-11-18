# NIRIKSHAK PLATFORM — DATA PRIVACY & PROTECTION SPECIFICATION

**Document Version:** 1.0.0  
**Status:** ACTIVE  
**Compliance Standard:** India Digital Personal Data Protection Act (DPDPA 2023) / ISO 27701  

---

## 1. Overview & Data Classification

The NIRIKSHAK platform processes civic grievances, government project allocations, contractor commercial bids, and drone/site imagery. All data within the system is strictly classified into four operational tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA CLASSIFICATION                      │
├───────────────┬─────────────────────────────────────────────┤
│ RESTRICTED    │ Passwords, JWTs, Supabase Service Keys,    │
│               │ OpenRouter API Keys, DB Passwords           │
├───────────────┼─────────────────────────────────────────────┤
│ CONFIDENTIAL  │ Contractor Commercial Bids, Detailed Bill   │
│               │ of Quantities, Internal Government Notes,   │
│               │ Citizen Aadhaar / Phone / Email Addresses   │
├───────────────┼─────────────────────────────────────────────┤
│ INTERNAL      │ Draft Tenders, Unverified Progress Updates, │
│               │ Site Inspection Logs, Raw AI Job Logs       │
├───────────────┼─────────────────────────────────────────────┤
│ PUBLIC        │ Verified Project Progress, Sanctioned       │
│               │ Budgets, Public Geo-coordinates, Grievance  │
│               │ Counts (Anonymized Aggregations)            │
└───────────────┴─────────────────────────────────────────────┘
```

---

## 2. Citizen PII Minimization & Masking

### 2.1 Identity & Profile Data
- Citizen phone numbers, email addresses, and home addresses are never exposed in public project views or open APIs.
- The `profiles` table is guarded by RLS ensuring that citizens can only inspect and modify their own records (`id = auth.uid()`).
- No national identity tokens (e.g., Aadhaar, PAN) are required or stored in plaintext.

### 2.2 Public Civic Grievances (Complaints)
- **Private View:** A citizen tracking their own grievance sees the status, updates, and their original submission (`user_id = auth.uid()`).
- **Public Projections:** When complaints are viewed by the general public or unauthenticated citizens, the API returns anonymized statistical aggregations (e.g., `{"total_issues": 14, "resolved": 11, "in_progress": 3}`) rather than individual citizen names, phone numbers, or geo-locations of private residences.
- **Tracking Endpoint (`GET /api/complaints/track/:ref`):** Responses explicitly mask the citizen's contact details:
  ```json
  {
    "complaint_reference": "CMP-2026-8812",
    "status": "IN_PROGRESS",
    "category": "Road Damage",
    "citizen_name": "R**** S****",
    "masked_contact": "******8821"
  }
  ```

---

## 3. Commercial Bid Confidentiality (Contractor Privacy)

To guarantee fair market competition and prevent industrial espionage or collusion:
- **Contractor Tenant Isolation:** Contractor A can never query or inspect the bid amounts, technical proposals, equipment schedules, or financial guarantees submitted by Contractor B.
- **Enforcement at Database Level:** The `tender_bids` table RLS policy restricts `SELECT` operations such that contractors only see bids where `contractor_organization_id = get_current_user_organization_id()`.
- **Government Authority Scoping:** Government officers only see submitted bids after the tender moves from `DRAFT` to `PUBLISHED` and bidding has closed, scoped strictly to their jurisdiction.

---

## 4. Artificial Intelligence Data Privacy (OpenRouter / NVIDIA Nemotron)

### 4.1 Zero Direct Frontend AI Invocations
All AI processing is routed through the backend service hosted on Render. Under no circumstances does the frontend browser communicate directly with OpenRouter or hold AI credentials.

### 4.2 Automated Context Sanitization Pipeline
Before any prompt or operational context is dispatched to the AI provider, it is processed by `sanitizeAiContext()` (`backend/src/ai/provider.ts`):
1. **PII Scrubbing:**
   - Email addresses: Replaced with `[EMAIL_REDACTED]`
   - Indian phone numbers (`+91...`, 10-digit formats): Replaced with `[PHONE_REDACTED]`
   - 12-digit Aadhaar patterns: Replaced with `[AADHAAR_REDACTED]`
2. **Secret & Key Scrubbing:**
   - JWT tokens (`eyJ...`): Replaced with `[JWT_REDACTED]`
   - API keys and service tokens: Stripped before transmission
   - Passwords and secret fields: Redacted
3. **Commercial Protection:**
   - Raw competitor bid valuations and private contractor proposals are excluded from LLM context unless explicitly performing an authorized tender evaluation under strict government tenancy.

### 4.3 Safe AI Audit Logging
- Raw user prompts and unsanitized contexts are **never** written to server logs or permanent disk.
- Audit logs record only execution metadata: `job_id`, `project_id`, `provider`, `model`, `prompt_hash`, `latency_ms`, `token_count`, and `status`.

---

## 5. Immutable Audit Trail

- Security-sensitive actions (Government approvals, Contractor verifications, Tender publication, Contract award, Progress approvals) produce append-only audit entries in `public.audit_logs`.
- Normal users and contractors have **no write, update, or delete access** to `audit_logs`.
- Government compliance auditors have read-only access to audit logs within their jurisdictional authority.

---
*End of Data Privacy Specification.*
