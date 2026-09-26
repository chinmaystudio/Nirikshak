# NIRIKSHAK (निरीक्षक) — Infrastructure Monitoring & Public Accountability Platform
**Release**: `v1.0.0`  
**License**: MIT / Open Governance  

NIRIKSHAK is an evidence-driven infrastructure monitoring, multi-tier procurement, and public accountability platform. It connects **Government Authorities**, **Infrastructure Contractors**, and **Citizens** into one continuous, audited lifecycle backed by PostgreSQL Row Level Security (RLS) and asynchronous AI risk assessment using **NVIDIA Nemotron-3 Super 120B** via OpenRouter.

---

## 1. Core Portals

| Portal | Canonical Route | Target Audience | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Government Portal** | `/government` | Municipal authorities, project officers, chief engineers | Project register, tender publishing, bid evaluation, atomic contract award, progress review queue, grievance triage. |
| **Contractor Portal** | `/contractor` | Infrastructure construction companies, site engineers | Tender discovery, encrypted bid submission, assigned project workspaces, milestone progress filing with evidence. |
| **Citizen / User Portal**| `/` and `/user` | General public, community residents | Public verified project discovery, localized geo-tagged grievance filing, resolution tracking, infrastructure vision scanner. |

---

## 2. System Architecture & Invariants

```
             GOVERNMENT PORTAL
                     │
       Tender / Award / Field Review
                     ▼
           SUPABASE POSTGRESQL (RLS)
         [Authoritative Source of Truth]
           ┌─────────┴─────────┐
           ▼                   ▼
   CONTRACTOR PORTAL     CITIZEN PORTAL
   Bid / Progress Claim  Public View / Complaints
           │                   │
           └─────────┬─────────┘
                     ▼
             AI Analysis Pipeline
      (NVIDIA Nemotron-3 Super 120B)
```

- **The Official Progress Rule**: Contractor submissions are recorded as claims (`SUBMITTED`). Public transparency views (`public_projects_view`) strictly expose **only** officially approved progress signed off by verified Government engineers.
- **Zero Mock Data in Production**: All dashboards, tables, and metrics query authoritative PostgreSQL tables. No synthetic fallbacks exist on query error.
- **Portal Style Isolation**: Scoped root containers (`.portal-government`, `.portal-contractor`, `.portal-citizen`) prevent dark mode leakage across portals.

---

## 3. Quick Start & Local Setup

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- Supabase Project (PostgreSQL 15+)

### Clone & Install
```bash
git clone https://github.com/chinmaystudio/Nirikshak.git
cd Nirikshak

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install
```

### Environment Configuration
**`frontend/.env`**:
```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SHOW_DEMO_CREDENTIALS=true
```

**`backend/.env`**:
```env
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
AI_PROVIDER=openrouter
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b
OPENROUTER_API_KEY=<your-openrouter-key>
PORT=4000
ALLOW_TEST_USERS=true
```

### Database Migrations
Migrations are located in `backend/supabase/migrations/` (`001` through `022`). Apply them sequentially via Supabase CLI or SQL Editor:
- `021_procurement_progress_ai.sql`: Implements atomic `award_contract` and `submit_progress_update` RPCs.
- `022_rls_security_hardening.sql`: Restricts `ai_jobs` and `progress_updates` update policies to Government officials.

### Seed Verified Test Accounts
```bash
cd backend
npx tsx scripts/seed-test-users.ts
```

### Run Locally
```bash
# Terminal 1: Run Frontend (Vite)
cd frontend
npm run dev

# Terminal 2: Run Backend API
cd backend
npm run dev
```

---

## 4. Development Credentials (For Local & Staging Only)

| Portal | Login URL | Email | Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Government** | `/government/login` | `government.test@nirikshak.local` | `NirikshakGov#2026` | `government_admin` |
| **Contractor** | `/contractor/login` | `contractor.test@nirikshak.local` | `NirikshakContractor#2026` | `contractor_admin` |
| **Citizen** | `/user/login` | `citizen.test@nirikshak.local` | `NirikshakCitizen#2026` | `citizen` |

> [!WARNING]
> Demo passwords and credential helper buttons must never be displayed in production environments (`VITE_SHOW_DEMO_CREDENTIALS=false`).

---

## 5. Automated Verification & Testing

```bash
# Run End-to-End Workflow Verification
cd backend
npx tsx scripts/test-e2e-workflow.ts

# Run Automated Row Level Security (RLS) Tests
npx tsx scripts/test-security-rls.ts

# Run AI Evaluation Harness (50 Historical Cases)
npx tsx scripts/evaluate-ai-pipeline.ts

# Run System Telemetry & Metrics Collection
npx tsx scripts/measure-system-metrics.ts
```

---

## 6. Deployment
- **Frontend**: Single-Page Application deployed to Vercel with SPA fallback rewriting (`/* /index.html 200`).
- **Backend**: Containerized Node/Express service running on Node 22 runtime.
- **CI / CD**: GitHub Actions (`.github/workflows/ci.yml`) automatically typechecks, tests, and builds frontend and backend on push/PR to `main`.
