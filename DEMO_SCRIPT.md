# NIRIKSHAK PLATFORM — OFFICIAL END-TO-END DEMO SCRIPT
**Scenario**: "From Greenfield Tender to Ground-Level Citizen Accountability"  
**Duration**: 8–12 Minutes  
**Demo Project**: `NIRIKSHAK E2E DEMO PROJECT` (`NIR-DEMO-2026-001`)  
**Target Environment**: Chrome / Edge Dual-Window Setup (Window A: Government; Window B: Contractor; Window C: Citizen)  

---

## 0. Demo Prerequisites & Pre-Flight (1 Minute)

### Credentials Reference
| Role | Portal URL | Login Email | Password |
| :--- | :--- | :--- | :--- |
| **Government Admin** | `/government/login` | `government.test@nirikshak.local` | `NirikshakGov#2026` |
| **Contractor Admin** | `/contractor/login` | `contractor.test@nirikshak.local` | `NirikshakContractor#2026` |
| **Citizen** | `/user/login` | `citizen.test@nirikshak.local` | `NirikshakCitizen#2026` |

---

## Act I: Government Establishes Project & Procurement (3 Minutes)

### Step 1: Government Authority Authentication
- **Action**: Open Window A to `/government/login`. Click "Demo Credentials: Administrator" or enter email and password. Click **Sign In**.
- **What Appears**: Government Executive Oversight Dashboard (`/government/dashboard`) displaying regional KPI summary cards, budget utilization, and live active project tables.
- **Narrative**: *"NIRIKSHAK unifies fragmented infrastructure tracking into an authoritative source of truth. As the Pune Infrastructure Monitoring Authority, we see verified projects and live alerts."*

### Step 2: Tender Publishing
- **Action**: Navigate to `/government/projects/462bd960-a17f-4c11-8e7a-ea723bc3e861/tenders`. Click **+ Create New Tender**.
- **Input**:
  - Title: `Package 1 — Civil Construction & Feeder Electrification`
  - Estimated Outlay: `₹185.00 Cr`
  - Procurement Mode: `Open Competitive Bidding`
- **Action**: Click **Publish Tender**.
- **Audience Observes**: Tender status instantly flips to **PUBLISHED**. A database trigger emits a `TENDER_PUBLISHED` Realtime event.

---

## Act II: Contractor Tender Discovery & Secure Bidding (2.5 Minutes)

### Step 3: Contractor Portal Discovery
- **Action**: Switch to Window B at `/contractor/login`. Sign in as `contractor.test@nirikshak.local`.
- **What Appears**: Clean institutional Contractor Operational Workspace (`/contractor/dashboard`).
- **Action**: Click **Tenders** in the navigation bar (`/contractor/tenders`).
- **Audience Observes**: The published tender for the Demo Project is immediately visible with official procurement documentation and countdown deadline.

### Step 4: Encrypted Bid Submission
- **Action**: Click on the tender card $\rightarrow$ Click **Submit Bid**.
- **Input**:
  - Financial Quotation: `₹178.50 Cr`
  - Technical Score: `94/100`
  - Methodology: `Modular precast girder erection with localized dust suppression`
- **Action**: Click **Submit Official Bid**.
- **Audience Observes**: Success toast with generated reference `NIR-BID-2026-...`. Server-side PostgreSQL RPC cryptographically associates `submitted_by = auth.uid()` and isolates competitor bids.

---

## Act III: Atomic Contract Award & Assignment (1.5 Minutes)

### Step 5: Government Evaluation & Atomic Award
- **Action**: Switch back to Window A (`/government/projects/462bd960-a17f-4c11-8e7a-ea723bc3e861/tenders`).
- **Audience Observes**: Contractor's bid appears in the evaluation queue.
- **Action**: Select the bid $\rightarrow$ Click **Award Contract**.
- **What Happens Under the Hood**: PostgreSQL atomic stored procedure `award_contract` executes:
  1. Locks tender with `FOR UPDATE`
  2. Sets tender status to `AWARDED`
  3. Marks selected bid `SELECTED` and competing bids `REJECTED`
  4. Generates legal contract `CNT-2026-F26C7501`
  5. Inserts project assignment in `project_organizations`
- **Audience Observes**: Tender badge turns green **AWARDED**. In Window B, Contractor instantly receives Realtime notification: *"Contract Awarded: Package 1"*.

---

## Act IV: Progress Execution, AI Risk Analysis & Field Verification (2.5 Minutes)

### Step 6: Contractor Progress Filing
- **Action**: In Window B, navigate to `/contractor/projects` $\rightarrow$ Open Demo Project $\rightarrow$ Click **Update Progress** (`/projects/:id/update`).
- **Input**:
  - Reported Physical Progress: `42%`
  - Work Completed: `Substructure piling complete; pier caps placed on piers 1-14`
  - Issues / Delays: `Minor traffic diversion delay near Shivajinagar junction`
- **Action**: Click **Submit Progress Update**.
- **Audience Observes**: Progress update saved with status `SUBMITTED`. Asynchronous job queued in `ai_jobs`.

### Step 7: OpenRouter NVIDIA Nemotron-3 Super Analysis
- **Narrative**: *"NIRIKSHAK uses NVIDIA Nemotron-3 Super 120B via OpenRouter to analyze structural filings without replacing human authority."*
- **Action**: Switch to Window A $\rightarrow$ Navigate to **AI Risk Insights** (`/government/projects/:id/ai-insights`).
- **Audience Observes**: Structured AI analysis displays:
  - Overall Risk: `MEDIUM (48/100)`
  - Schedule Risk: Identifies variance against milestone target
  - Environment: Validates dust suppression notes
  - Explicit Disclaimer: *"AI does not approve projects or determine official progress."*

### Step 8: The Official Progress Invariant Test
- **Action**: Open Window C (Citizen view at `/user/projects/462bd960-a17f-4c11-8e7a-ea723bc3e861`).
- **Audience Observes**: The public project still displays **0%** (Baseline verified). Contractor's unverified claim of 42% is **NEVER** exposed publicly!
- **Action**: In Window A, Government Officer opens Progress Review $\rightarrow$ Enters Verified Field Progress: **38%** $\rightarrow$ Click **Approve Progress**.
- **Audience Observes**: In Window C (Citizen view), official progress immediately updates to **38%** via Supabase Realtime!

---

## Act V: Citizen Civic Redressal & Loop Closure (1.5 Minutes)

### Step 9: Citizen Grievance Filing
- **Action**: In Window C, Citizen clicks **Report Ground Issue** (`/user/report`).
- **Input**:
  - Category: `Safety / Road Access`
  - Severity: `Medium`
  - Title: `Excavated soil spilling onto bicycle track`
  - Description: `Rain runoff causing mud accumulation near Pier 8.`
- **Action**: Click **Submit Report**.
- **Audience Observes**: Complaint reference number generated (`CMP-...`).

### Step 10: Government Resolution & Audit Trail
- **Action**: In Window A, Government navigates to `/government/complaints`.
- **Audience Observes**: New grievance appears. Officer clicks **Resolve** $\rightarrow$ Notes: *"Contractor notified. Debris cleared and silt fence erected."*
- **Action**: Citizen in Window C sees complaint status update to **RESOLVED**.
- **Action**: Government opens `/government/projects/:id/audit` to show the immutable cryptographic audit log spanning tender creation, bidding, contract award, progress approval, and grievance redressal.

---

## 6. Closing Statement (30 Seconds)
*"NIRIKSHAK is not just a dashboard or chatbot. It is a full-lifecycle, role-isolated, evidence-driven platform enforcing accountability from government planning to citizen verification."*
