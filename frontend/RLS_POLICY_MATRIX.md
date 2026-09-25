# NIRIKSHAK Row Level Security (RLS) Policy Matrix

## 1. Overview
All 34 application tables in the NIRIKSHAK database have Row Level Security enabled. Client queries authenticated via Supabase Auth evaluate PostgreSQL security policies.

---

## 2. Policy Matrix by Table and Role

| Table | Citizen (Anon / Authenticated) | Contractor User | Government User | Auditor |
|---|---|---|---|---|
| **projects** | SELECT `is_public = true` only | SELECT assigned projects & public | FULL (SELECT, INSERT, UPDATE) | SELECT ALL (No UPDATE) |
| **project_milestones** | SELECT public projects only | SELECT assigned projects only | FULL (SELECT, INSERT, UPDATE) | SELECT ALL |
| **progress_updates** | NO ACCESS (Never unverified) | INSERT & SELECT own org submissions | FULL (SELECT, UPDATE verification) | SELECT ALL |
| **progress_evidence** | NO ACCESS (Internal operational) | INSERT & SELECT own submissions | FULL ACCESS | SELECT ALL |
| **complaints** | INSERT any; SELECT own; SELECT public stats | SELECT complaints assigned to org | FULL (Triage, Assign, Resolve) | SELECT ALL |
| **complaint_evidence** | INSERT own; SELECT own | SELECT assigned | FULL ACCESS | SELECT ALL |
| **tenders** | SELECT `is_public = true` only | SELECT open tenders | FULL (Create, Publish, Edit) | SELECT ALL |
| **tender_bids** | NO ACCESS | INSERT & SELECT own bids only | SELECT & Review all bids | SELECT ALL |
| **contracts** | SELECT public contract summary | SELECT own awarded contracts | FULL ACCESS | SELECT ALL |
| **organizations** | SELECT verified public profiles | SELECT own organization | FULL ACCESS | SELECT ALL |
| **organization_members**| NO ACCESS | SELECT members of own org | FULL ACCESS | SELECT ALL |
| **audit_logs** | NO ACCESS | NO ACCESS | SELECT relevant events | SELECT ALL (Read-only) |
| **ai_insights** | SELECT approved public summaries | SELECT assigned project risks | FULL ACCESS | SELECT ALL |
| **environmental_observations** | SELECT public metrics | INSERT & SELECT own sensor feeds | FULL ACCESS | SELECT ALL |

---

## 3. SQL Security Helper Functions
The following PostgreSQL functions enforce RLS without client-side spoofing:
- `is_government_user()`: Checks if `auth.uid()` has an active government role.
- `is_contractor_user()`: Checks if `auth.uid()` belongs to an active contractor organization.
- `is_citizen()`: Verifies citizen status.
- `belongs_to_organization(org_id)`: Checks membership in the specified organization.
- `can_access_project(p_id)`: Evaluates public visibility, government status, or contractor assignment in `project_organizations`.
- `can_manage_project(p_id)`: Verifies administrative authority over the project.
