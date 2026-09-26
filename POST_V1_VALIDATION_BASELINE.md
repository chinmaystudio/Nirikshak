# NIRIKSHAK V1.0 — POST-V1 VALIDATION BASELINE
**Date**: September 26, 2026  
**Auditor / Principal Research Lead**: Principal Systems & Validation Engineer  
**Baseline Commit**: `172ad6f4a643c2c251ee4ffffe1889b5eac0735d`  
**Repository**: `chinmaystudio/Nirikshak`  
**Branch**: `main`  

---

## 1. System Baseline Verification

| Component | Status | Details / Evidence |
| :--- | :---: | :--- |
| **Git Working Tree** | Clean | Remote `origin/main` in sync; 0 uncommitted changes. |
| **Frontend Deployment Target** | Active | Vite SPA architecture with Vercel rewrites (`/* /index.html 200`). |
| **Backend API Service** | Active | Express + TypeScript API runtime compiled to `/dist`. |
| **Supabase Project** | Connected | `https://dmkhkgqyzevhxpxsrgng.supabase.co` with active PostgreSQL and Realtime. |
| **CI / CD Pipeline** | Passing | GitHub Actions workflow `.github/workflows/ci.yml` validates frontend/backend lint, typecheck, tests, and build. |

---

## 2. Test Account Verification Matrix

All three roles verified operational via Supabase Auth cryptographic challenge:

| Account Role | Email | Password | Supabase Auth Status | Profile Binding |
| :--- | :--- | :--- | :---: | :---: |
| **Government Admin** | `government.test@nirikshak.local` | `NirikshakGov#2026` | **VERIFIED WORKING** | `government_admin` |
| **Contractor Admin** | `contractor.test@nirikshak.local` | `NirikshakContractor#2026` | **VERIFIED WORKING** | `contractor_admin` |
| **Citizen** | `citizen.test@nirikshak.local` | `NirikshakCitizen#2026` | **VERIFIED WORKING** | `citizen` |

---

## 3. End-to-End Workflow Status

- **Tender Creation & Publication**: Operational (`tenders` table with `status = 'PUBLISHED'`).
- **Contractor Bid Submission**: Operational (`tender_bids` table with server-derived `submitted_by`).
- **Atomic Contract Award**: Operational (`award_contract` RPC locks tender, selects winning bid, rejects others, generates contract, assigns contractor organization).
- **Contractor Progress Filing**: Operational (`submit_progress_update` RPC validates contractor assignment and bounds 0-100%).
- **Official Progress Rule**: Confirmed Invariant — Citizen view (`public_projects_view`) never exposes raw contractor claims (78%) until Government field review approves verified progress (71%).
- **Citizen Grievance Pipeline**: Operational (`complaints` table insertion and status update).

---

## 4. Known Baseline Limitations
1. Storage evidence uploads rely on `progress-evidence` bucket policies configured in migrations; bucket existence is assumed in Supabase storage service.
2. In environments lacking `OPENROUTER_API_KEY`, the AI analysis engine deterministically calculates risk metrics from verified PostgreSQL database records without hallucination.

**Baseline Verdict**: System is **STABLE** and verified ready for Phase B release freezing and Phase C-L validation studies.
