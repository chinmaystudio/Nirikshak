# NIRIKSHAK Database Schema Documentation

## 1. Overview
The NIRIKSHAK platform runs on **Supabase PostgreSQL** as its single source of truth. The schema is organized into 18 structured migrations containing 34 relational tables, domain enums, computed views, stored procedures (RPCs), and Row Level Security (RLS) policies.

---

## 2. Core Entities & Tables

### 2.1 Projects (`public.projects`)
Stores official and imported infrastructure projects from the Pune and national registry.
- `id` (UUID, PK, `gen_random_uuid()`)
- `nirikshak_project_id` (TEXT, UNIQUE, NOT NULL) — e.g., `NIR-PUNE-METRO-001`
- `official_project_id` (TEXT)
- `project_name` (TEXT, NOT NULL)
- `description` (TEXT)
- `sector` (TEXT) — e.g., Transport, Urban Development, Water
- `subsector` (TEXT) — Metro Rail, Ring Road, Riverfront
- `project_type` (TEXT)
- `project_authority` (TEXT) — PMC, PCMC, PMRDA, MahaMetro, MSRDC
- `implementing_agency` (TEXT)
- `contractor_concessionaire` (TEXT)
- `state` (TEXT, default: 'Maharashtra')
- `city` (TEXT, default: 'Pune')
- `latitude` (DOUBLE PRECISION)
- `longitude` (DOUBLE PRECISION)
- `total_cost_inr_crore` (NUMERIC) — NULL preserved when unrecorded
- `original_cost_inr_crore` (NUMERIC)
- `revised_cost_inr_crore` (NUMERIC)
- `physical_progress_percent` (NUMERIC)
- `financial_progress_percent` (NUMERIC)
- `reported_status` (TEXT) — Original status from source
- `normalized_status` (TEXT) — Standardized enum (`PROPOSED`, `APPROVED`, `UNDER_CONSTRUCTION`, `DELAYED`, `COMPLETED`, etc.)
- `record_scope` (TEXT)
- `current_status_verified` (BOOLEAN)
- `quality_score` (NUMERIC)
- `source_record_id` (TEXT)
- `primary_source_url` (TEXT)
- `is_public` (BOOLEAN, default: TRUE)
- `created_at`, `updated_at`, `deleted_at` (TIMESTAMPTZ)

### 2.2 Project Milestones (`public.project_milestones`)
Stores milestone breakdown. Progress rollups originate here.
- `id` (UUID, PK)
- `project_id` (UUID, FK -> `projects.id`)
- `milestone_name` (TEXT)
- `description` (TEXT)
- `planned_start_date`, `planned_end_date` (DATE)
- `actual_start_date`, `actual_end_date` (DATE)
- `planned_progress` (NUMERIC)
- `verified_progress` (NUMERIC)
- `status` (TEXT)

### 2.3 Progress Updates (`public.progress_updates`)
Contractor-submitted progress reports awaiting government verification.
- `id` (UUID, PK)
- `project_id` (UUID, FK -> `projects.id`)
- `milestone_id` (UUID, FK -> `project_milestones.id`)
- `contractor_organization_id` (UUID, FK -> `organizations.id`)
- `reported_progress` (NUMERIC) — Contractor unverified value
- `verified_progress` (NUMERIC) — Official verified value
- `verification_status` (TEXT) — `SUBMITTED`, `APPROVED`, `REJECTED`, `REQUEST_CLARIFICATION`
- `description` (TEXT)
- `submitted_by` (UUID)
- `reviewed_by` (UUID)
- `review_notes` (TEXT)
- `reviewed_at` (TIMESTAMPTZ)

### 2.4 Complaints & Grievances (`public.complaints`)
Citizen-submitted infrastructure issues.
- `id` (UUID, PK)
- `reference_number` (TEXT, UNIQUE) — e.g., `NIR-CMP-2026-789012`
- `project_id` (UUID, FK -> `projects.id`)
- `user_id` (UUID)
- `category` (TEXT) — Pothole, Drainage, Dust, Structural, Safety, Delay
- `title` (TEXT)
- `description` (TEXT)
- `latitude`, `longitude` (DOUBLE PRECISION)
- `severity` (TEXT) — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `status` (TEXT) — `SUBMITTED`, `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `REJECTED`, `CLOSED`
- `assigned_organization_id` (UUID)
- `resolved_at` (TIMESTAMPTZ)

### 2.5 Organizations & Members (`public.organizations`, `public.organization_members`)
Multi-tenant organizational structure.
- Types: `government`, `contractor`, `consultant`, `PSU`, `ULB`, `authority`
- Roles: `citizen`, `government_admin`, `project_officer`, `government_engineer`, `chief_engineer`, `auditor`, `contractor_admin`, `contractor_manager`, `contractor_site_engineer`

### 2.6 Tenders & Contracts (`public.tenders`, `public.tender_bids`, `public.contracts`)
Full procurement lifecycle from publication to award.

### 2.7 Environment (`public.environmental_observations`, `public.environmental_incidents`, `public.environmental_commitments`)
Metrics tracking (PM2.5, PM10, noise, water quality) and planned vs actual mitigation.

### 2.8 Sources & Provenance (`public.sources`, `public.source_observations`)
47 verified official infrastructure registries tracking publisher, URL, and observation audit trail.

### 2.9 AI Engine (`public.ai_runs`, `public.ai_insights`)
Stores automated risk assessment runs, prompt versions, latency, risk scores, and evidence JSON.

---

## 3. Database Views
- `public_projects_view`: Secure projection of approved public data for citizens.
- `government_project_summary_view`: Comprehensive administrative rollup with budget and complaint counts.
- `contractor_assigned_projects_view`: Projects scoped strictly to contractor organization assignments.
