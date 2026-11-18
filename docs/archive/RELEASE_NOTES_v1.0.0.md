# NIRIKSHAK v1.0.0 Release Notes
**Release Tag**: `v1.0.0`  
**Release Date**: September 26, 2026  
**Commit SHA**: `172ad6f4a643c2c251ee4ffffe1889b5eac0735d`  
**Target Architecture**: Supabase PostgreSQL 15+, React 18, Vite 5, Express / TypeScript Backend  

---

## 1. Overview

NIRIKSHAK is an evidence-driven infrastructure monitoring, multi-tier procurement, and public accountability platform. It connects Government Authorities, Infrastructure Contractors, and Citizens into one continuous, audited lifecycle backed by PostgreSQL Row Level Security and asynchronous AI risk assessment.

---

## 2. Core Portals

### 2.1 Government Portal (`/government`)
- **Executive Oversight**: Real-time project KPI dashboard (physical vs. financial progress, budget utilization, delay flags).
- **Workspace Navigation**: Project-scoped workspaces (`/government/projects/:id/*`) for budget, tenders, contractor evaluation, execution, milestones, complaints, approvals, documents, and audit logs.
- **Review Queues**: Official verification of contractor progress submissions with authority to approve, reject, or request clarification.
- **Access Control**: Strict role guarding for `government_admin`, `government_engineer`, and related statutory roles.

### 2.2 Contractor Portal (`/contractor`)
- **Tender Bidding**: Browse published procurement tenders and submit encrypted bids via secure server-side RPC.
- **Assigned Projects**: Clear isolation showing only projects under active contract with the authenticated contractor organization.
- **Progress Reporting**: Milestone-based physical progress updates with photo, video, and structural evidence submission.
- **Institutional Design**: Clean, portal-isolated styling with zero CSS bleed into external interfaces.

### 2.3 Citizen / User Portal (`/user`, `/`)
- **Public Transparency**: Real-time access to verified infrastructure projects via `public_projects_view`.
- **Grievance Redressal**: Geo-tagged civic complaint filing with severity levels, category tagging, and public status tracking.
- **Infrastructure Vision**: Experimental visual recognition tool for identifying infrastructure site assets.
- **Security Invariant**: Strictly enforces authenticated sessions for personal routes (`/user/home`, `/user/complaints`, `/user/profile`) while keeping civic transparency open.

---

## 3. Architecture & Dataflow

### 3.1 Supabase PostgreSQL as Source of Truth
- **Row Level Security (RLS)**: Enforced across all primary tables (`projects`, `tenders`, `tender_bids`, `contracts`, `progress_updates`, `complaints`, `ai_jobs`, `ai_insights`).
- **Atomic Stored Procedures**:
  - `award_contract(tender_id, bid_id)`: Multi-table atomic transaction that selects the winning bid, rejects competing bids, marks tender awarded, generates official contract, and creates project organization assignment.
  - `submit_progress_update(project_id, progress, description, milestone)`: Validates active contractor assignment and progress bounds (0–100%), inserts update with `SUBMITTED` status, and triggers async AI audit jobs.
- **Official Progress Rule**: Invariant guaranteeing that public-facing projections only reflect Government-verified metrics, preventing unverified contractor claims from masquerading as official data.

### 3.2 Supabase Realtime
- Active publication `supabase_realtime` broadcasting state changes across scoped channels (`project:<id>`, `user:<id>`, `government:<id>`, `contractor:<id>`).

### 3.3 Artificial Intelligence & Nemotron Integration
- **Model**: `nvidia/nemotron-3-super-120b-a12b` via OpenRouter.
- **System Guardrails**: Evidence-only evaluation distinguishing contractor claims from verified facts; returns `UNKNOWN` when signals are absent; strictly validated via Zod schema.
- **Privacy First**: Automatic PII sanitization strips tokens, passwords, Aadhaar, and personal contact info prior to AI execution.

---

## 4. Quality & Verification Baseline
- **TypeScript**: 0 typecheck errors across frontend and backend.
- **Build**: Production Vite build completed with optimized chunk code-splitting.
- **Automated E2E**: Continuous lifecycle test (`test-e2e-workflow.ts`) verifying citizen query, contractor bidding, atomic award, progress filing, invariant verification, and complaint resolution.
- **Test Accounts**: 3 verified development accounts (`government.test@nirikshak.local`, `contractor.test@nirikshak.local`, `citizen.test@nirikshak.local`).

---

## 5. Deployment & Configuration
- **Frontend**: Single-Page Application configured with Vercel SPA rewrites.
- **CI / CD**: GitHub Actions workflow `.github/workflows/ci.yml` verifying lint, typecheck, tests, and build on every push to `main`.
