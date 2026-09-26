# NIRIKSHAK — FINAL UI ROUTE MATRIX
**Date**: September 26, 2026  
**Auditor**: Principal Systems Engineer  
**Baseline**: Commit `8577ec1cd82ae4896147ebb5904f347d6e6d985c`  

This matrix documents the verification of all routes discovered across the Government, Contractor, and Citizen portals.

---

## 1. Government Portal Routes (`/government`)

| Route | Canonical Path | Auth Required | Page Opens | Data Source | Actions Tested | Console Errors | Mobile (375x812) | Desktop (1920x1080) | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `/government/login` | `/government/login` | No | Yes | Supabase Auth | Sign in, validation, role routing | 0 | Pass | Pass | **PASS** |
| `/government/register` | `/government/register` | No | Yes | Supabase Auth + Requests | Access request submission | 0 | Pass | Pass | **PASS** |
| `/government/forgot-password` | `/government/forgot-password` | No | Yes | Supabase Auth | Password reset request | 0 | Pass | Pass | **PASS** |
| `/government/dashboard` | `/government/dashboard` | Yes (Gov) | Yes | Supabase `projects`, `tenders` | KPI metrics, sector filters, charts | 0 | Pass | Pass | **PASS** |
| `/government/projects` | `/government/projects` | Yes (Gov) | Yes | Supabase `projects` | Search, status filtering, table sorting | 0 | Pass | Pass | **PASS** |
| `/government/projects/create` | `/government/projects/create` | Yes (Gov) | Yes | Supabase `projects` (insert) | Multi-step form, coordinates geocoding | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id` | `/government/projects/:id` | Yes (Gov) | Yes | Supabase `projects` | Overview KPI, map view, milestones | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/budget` | `/government/projects/:id/budget` | Yes (Gov) | Yes | Supabase `contracts`, `projects` | Outlay vs expenditure breakdown | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/tenders` | `/government/projects/:id/tenders` | Yes (Gov) | Yes | Supabase `tenders`, `tender_bids` | Tender creation, bid review, contract award | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/contractor-evaluation` | `/government/projects/:id/contractor-evaluation` | Yes (Gov) | Yes | Supabase `organizations` | Scoring, compliance history | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/contractors` | `/government/projects/:id/contractors` | Yes (Gov) | Yes | Supabase `project_organizations` | Assigned contractor details | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/execution` | `/government/projects/:id/execution` | Yes (Gov) | Yes | Supabase `progress_updates` | Progress review queue, verify progress | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/milestones` | `/government/projects/:id/milestones` | Yes (Gov) | Yes | Supabase `project_milestones` | Milestone tracking, target dates | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/complaints` | `/government/projects/:id/complaints` | Yes (Gov) | Yes | Supabase `complaints` | Grievance triage, assignment | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/approvals` | `/government/projects/:id/approvals` | Yes (Gov) | Yes | Supabase `approvals` | Sign-off queue, authorization | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/alerts` | `/government/projects/:id/alerts` | Yes (Gov) | Yes | Supabase `alerts` | Risk threshold alerts | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/documents` | `/government/projects/:id/documents` | Yes (Gov) | Yes | Supabase `documents` | Blueprint, compliance files | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/audit` | `/government/projects/:id/audit` | Yes (Gov) | Yes | Supabase `audit_logs` | Immutable change logs | 0 | Pass | Pass | **PASS** |
| `/government/projects/:id/ai-insights` | `/government/projects/:id/ai-insights` | Yes (Gov) | Yes | Supabase `ai_insights`, Nemotron | Risk radar, anomaly warnings | 0 | Pass | Pass | **PASS** |
| `/government/complaints` | `/government/complaints` | Yes (Gov) | Yes | Supabase `complaints` | Global grievance inbox | 0 | Pass | Pass | **PASS** |
| `/government/approvals` | `/government/approvals` | Yes (Gov) | Yes | Supabase `approvals` | Cross-project approval stream | 0 | Pass | Pass | **PASS** |
| `/government/alerts` | `/government/alerts` | Yes (Gov) | Yes | Supabase `alerts` | System notifications | 0 | Pass | Pass | **PASS** |
| `/government/documents` | `/government/documents` | Yes (Gov) | Yes | Supabase `documents` | Central repository | 0 | Pass | Pass | **PASS** |
| `/government/audit` | `/government/audit` | Yes (Gov) | Yes | Supabase `audit_logs` | Global audit trail | 0 | Pass | Pass | **PASS** |
| `/government/ai-insights` | `/government/ai-insights` | Yes (Gov) | Yes | Supabase `ai_insights` | Multi-project risk matrix | 0 | Pass | Pass | **PASS** |
| `/government/reports` | `/government/reports` | Yes (Gov) | Yes | Supabase Analytics | Exportable statutory briefs | 0 | Pass | Pass | **PASS** |
| `/government/settings` | `/government/settings` | Yes (Gov) | Yes | Supabase `profiles` | Officer preferences, department info | 0 | Pass | Pass | **PASS** |

---

## 2. Contractor Portal Routes (`/contractor`)

| Route | Canonical Path | Auth Required | Page Opens | Data Source | Actions Tested | Console Errors | Mobile (375x812) | Desktop (1920x1080) | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `/contractor/login` | `/contractor/login` | No | Yes | Supabase Auth | Sign in, validation | 0 | Pass | Pass | **PASS** |
| `/contractor/register` | `/contractor/register` | No | Yes | Supabase Auth + Requests | Contractor registration | 0 | Pass | Pass | **PASS** |
| `/contractor/forgot-password` | `/contractor/forgot-password` | No | Yes | Supabase Auth | Reset flow | 0 | Pass | Pass | **PASS** |
| `/contractor/dashboard` | `/contractor/dashboard` | Yes (Contractor) | Yes | Supabase `contracts`, `projects` | Operational summary, assigned sites | 0 | Pass | Pass | **PASS** |
| `/contractor/tenders` | `/contractor/tenders` | Yes (Contractor) | Yes | Supabase `tenders` | Browse active bids, filter dates | 0 | Pass | Pass | **PASS** |
| `/contractor/tenders/:id` | `/contractor/tenders/:id` | Yes (Contractor) | Yes | Supabase `tenders` | Tender specs, BOQ documents | 0 | Pass | Pass | **PASS** |
| `/contractor/tenders/:id/bid` | `/contractor/tenders/:id/bid` | Yes (Contractor) | Yes | Supabase `tender_bids` (RPC) | Bid submission, financial quotation | 0 | Pass | Pass | **PASS** |
| `/contractor/projects` | `/contractor/projects` | Yes (Contractor) | Yes | Supabase `contracts` (Assigned) | Assigned project catalog | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id` | `/contractor/projects/:id` | Yes (Contractor) | Yes | Supabase `contracts`, `projects` | Project workspace details | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id/update` | `/contractor/projects/:id/update` | Yes (Contractor) | Yes | Supabase `submit_progress_update` RPC | Progress reporting, evidence upload | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id/resources` | `/contractor/projects/:id/resources` | Yes (Contractor) | Yes | Supabase Store | Machinery & workforce allocations | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id/finance` | `/contractor/projects/:id/finance` | Yes (Contractor) | Yes | Supabase `contracts` | RA bill disbursements | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id/bills` | `/contractor/projects/:id/bills` | Yes (Contractor) | Yes | Supabase `contracts` | Invoice ledger | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id/inspection` | `/contractor/projects/:id/inspection` | Yes (Contractor) | Yes | Supabase `inspections` | Third-party inspection logs | 0 | Pass | Pass | **PASS** |
| `/contractor/projects/:id/communication`| `/contractor/projects/:id/communication` | Yes (Contractor) | Yes | Supabase Store | RFI notes with engineers | 0 | Pass | Pass | **PASS** |
| `/contractor/performance` | `/contractor/performance` | Yes (Contractor) | Yes | Supabase Store | Quality & schedule adherence score | 0 | Pass | Pass | **PASS** |
| `/contractor/calendar` | `/contractor/calendar` | Yes (Contractor) | Yes | Supabase Store | Milestone deadlines & inspections | 0 | Pass | Pass | **PASS** |
| `/contractor/notifications` | `/contractor/notifications` | Yes (Contractor) | Yes | Supabase `notifications` | Review notices & contract awards | 0 | Pass | Pass | **PASS** |

---

## 3. Citizen / User Portal Routes (`/user`, `/`)

| Route | Canonical Path | Auth Required | Page Opens | Data Source | Actions Tested | Console Errors | Mobile (375x812) | Desktop (1920x1080) | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `/` | `/` | No | Yes | Static / Intro | Portal overview, transparency highlights | 0 | Pass | Pass | **PASS** |
| `/user` | `/user` | No | Yes | Static / Intro | Citizen landing, quick links | 0 | Pass | Pass | **PASS** |
| `/user/login` | `/user/login` | No | Yes | Supabase Auth | Sign in, validation | 0 | Pass | Pass | **PASS** |
| `/user/register` | `/user/register` | No | Yes | Supabase Auth | Citizen registration | 0 | Pass | Pass | **PASS** |
| `/user/home` (`/user/app`) | `/user/home` | Yes (Citizen) | Yes | Supabase `public_projects_view` | Citizen personalized dashboard | 0 | Pass | Pass | **PASS** |
| `/user/projects` | `/user/projects` | No | Yes | Supabase `public_projects_view` | Project discovery, sector filters, map | 0 | Pass | Pass | **PASS** |
| `/user/projects/:id` | `/user/projects/:id` | No | Yes | Supabase `public_projects_view` | Verified progress (71%), project details | 0 | Pass | Pass | **PASS** |
| `/user/report` | `/user/report` | Yes (Citizen) | Yes | Supabase `complaints` (insert) | Issue filing, category selection | 0 | Pass | Pass | **PASS** |
| `/user/report/success` | `/user/report/success` | Yes (Citizen) | Yes | AppStore State | Complaint reference confirmation | 0 | Pass | Pass | **PASS** |
| `/user/complaints` | `/user/complaints` | Yes (Citizen) | Yes | Supabase `complaints` | Personal grievance tracking | 0 | Pass | Pass | **PASS** |
| `/user/complaints/:id` | `/user/complaints/:id` | Yes (Citizen) | Yes | Supabase `complaints` | Status timeline, resolution notes | 0 | Pass | Pass | **PASS** |
| `/user/community` | `/user/community` | No | Yes | Supabase `complaints` (public) | Area grievances feed | 0 | Pass | Pass | **PASS** |
| `/user/alerts` | `/user/alerts` | No | Yes | Supabase `alerts` | Public civic announcements | 0 | Pass | Pass | **PASS** |
| `/user/vision` | `/user/vision` | No | Yes | Vision Service / Canvas | Infrastructure photo recognition | 0 | Pass | Pass | **PASS** |
| `/user/vision/history` | `/user/vision/history` | No | Yes | Local store | Past scanned sites | 0 | Pass | Pass | **PASS** |
| `/user/assistant` | `/user/assistant` | No | Yes | Assistant Service | AI civic chatbot | 0 | Pass | Pass | **PASS** |
| `/user/profile` | `/user/profile` | Yes (Citizen) | Yes | Supabase `profiles` | User profile & locality preferences | 0 | Pass | Pass | **PASS** |
| `/user/settings` | `/user/settings` | Yes (Citizen) | Yes | App Store / Supabase | Font scale, language, notifications | 0 | Pass | Pass | **PASS** |

---

## 4. Route Summary
- Total Discovered Routes: **63**
- Total Tested Routes: **63**
- Uncaught Console Errors: **0**
- Responsive Breakpoints Tested: 375x812 (Mobile), 768x1024 (Tablet), 1920x1080 (Desktop)
- Overflows: None (Tables use responsive container scroll)
- All routes verified compliant with production readiness standards.
