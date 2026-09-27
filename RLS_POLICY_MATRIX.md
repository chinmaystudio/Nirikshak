# NIRIKSHAK PLATFORM — ROW LEVEL SECURITY (RLS) POLICY MATRIX

**Document Version:** 1.0.0  
**Status:** ENFORCED  
**Engine:** Supabase PostgreSQL 15+  

---

## 1. Principles of Authorization

1. **Default Deny:** Every table has Row Level Security enabled (`ENABLE ROW LEVEL SECURITY`). If no explicit policy allows an action, it is blocked by default.
2. **Authoritative Context:** Roles and tenant memberships are resolved through the database session `auth.uid()`, cross-referenced with `public.organization_members`. Client-submitted identity claims are ignored.
3. **Tenant Scoping:**
   - **Government:** Access is shared across members belonging to the same authorized Government organization (`organizations.type = 'GOVERNMENT'`).
   - **Contractor:** Strict tenant isolation. Contractors can only read and write data associated with their own company organization (`organizations.type = 'CONTRACTOR'`) or projects to which their company has been explicitly assigned.
   - **Citizen:** Read-only access to approved public project projections and public updates; access to own complaints.
   - **Anonymous:** Access to public landing pages and public project projections only.

---

## 2. Table-by-Table Policy Matrix

| Table | Operation | Anonymous | Citizen | Contractor | Government Officer | Government Admin | Enforcement Mechanism / Condition |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`profiles`** | SELECT | ❌ | Self only | Self only | Visible in project/org context | All | `id = auth.uid()` or shared org context |
| | INSERT/UPDATE | ❌ | Self only | Self only | Self only | Self only | `id = auth.uid()` |
| **`organizations`** | SELECT | ❌ | Active only | Member org only | Shared dept orgs | All | `can_access_org(id)` |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | ❌ | Admin only | RPC / Elevated DB procedure only |
| **`organization_members`** | SELECT | ❌ | Self only | Own org members | Shared org members | All org members | `can_view_org_member(org_id)` |
| | INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | ❌ | ❌ | **DENIED** to all direct client operations. Handled via `SECURITY DEFINER` approval RPCs |
| **`government_access_requests`** | SELECT | ❌ | Self only | ❌ | Shared dept | All dept requests | `user_id = auth.uid()` or Government Admin |
| | INSERT | ❌ | Authenticated | ❌ | ❌ | ❌ | Created via `register_government_account` RPC |
| | UPDATE | ❌ | ❌ | ❌ | ❌ | Admin via RPC | Processed exclusively via `approve_government_access_request` |
| **`contractor_access_requests`** | SELECT | ❌ | Self only | Self only | Shared dept | All | `user_id = auth.uid()` or Government Reviewer |
| | INSERT | ❌ | Authenticated | Authenticated | ❌ | ❌ | Registration request flow |
| | UPDATE | ❌ | ❌ | ❌ | ❌ | Admin via RPC | Processed exclusively via `approve_contractor_access_request` |
| **`projects`** | SELECT | Public only | Public only | Assigned projects only | Shared dept projects | All dept projects | `can_access_project(id)` |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | Dept projects | Dept projects | `can_manage_project(id)` |
| | DELETE | ❌ | ❌ | ❌ | ❌ | Admin only | Soft-delete with audit trail |
| **`project_organizations`** | SELECT | ❌ | ❌ | Assigned only | Shared dept | All dept | Assigned relationship mapping |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | ❌ | Admin via RPC | Created atomically during `award_contract` |
| **`project_milestones`** | SELECT | Public projection | Public projection | Assigned projects | Shared dept | All dept | `can_access_project(project_id)` |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | Dept projects | Dept projects | `can_manage_project(project_id)` |
| **`tenders`** | SELECT | Published only | Published only | Published only | Dept tenders (Draft + Published) | All dept tenders | `is_government_user()` or `status = 'PUBLISHED'` |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | Dept tenders | Dept tenders | `can_manage_project(project_id)` |
| **`tender_bids`** | SELECT | ❌ | ❌ | **Own bid only** | Authorized tender bids | Authorized tender bids | Contractor sees own bid (`contractor_org_id = current_org_id`); Gov sees bids on owned tenders |
| | INSERT/UPDATE | ❌ | ❌ | Own bid via RPC | ❌ | ❌ | Executed exclusively via `save_tender_bid()` |
| **`contracts`** | SELECT | ❌ | ❌ | Awarded to own org | Shared dept | All dept | Contractor sees own contracts; Gov sees authority contracts |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | ❌ | Admin via RPC | Created atomically via `award_contract()` RPC |
| **`progress_updates`** | SELECT | Verified only | Verified only | Assigned projects | Shared dept | All dept | Contractor sees own submissions; Citizen sees verified |
| | INSERT | ❌ | ❌ | Assigned projects | ❌ | ❌ | Executed via `submit_progress_update()` RPC |
| | UPDATE (Review) | ❌ | ❌ | ❌ | Dept reviewers | Dept reviewers | Executed via `approve_progress_update()` RPC |
| **`progress_evidence`** | SELECT | Public verified | Public verified | Assigned contractor | Shared dept | All dept | Scoped to project and update access |
| | INSERT | ❌ | ❌ | Assigned contractor | Dept officers | Dept officers | Validated file upload path |
| **`complaints`** | SELECT | Aggregated only | Own complaints | Assigned complaints | Dept complaints | All complaints | Citizen sees `user_id = auth.uid()`; Gov sees jurisdictional complaints |
| | INSERT | ❌ | Authenticated | ❌ | ❌ | ❌ | Intake with XSS sanitization and rate limiting |
| | UPDATE | ❌ | ❌ | Assigned status | Dept officers | Dept officers | Status updates and assignment workflows |
| **`notifications`** | SELECT | ❌ | Own only | Own org only | Own user/dept | Own user/dept | `recipient_user_id = auth.uid()` or org match |
| | INSERT | ❌ | ❌ | ❌ | System only | System only | Backend service role or DB triggers |
| **`audit_logs`** | SELECT | ❌ | ❌ | ❌ | Auditors only | Auditors only | Read-only for compliance officers |
| | INSERT | ❌ | ❌ | ❌ | ❌ | ❌ | Append-only via trusted procedures |
| | UPDATE/DELETE | ❌ | ❌ | ❌ | ❌ | ❌ | **IMMUTABLE** (Prohibited for all) |
| **`storage.objects`** | SELECT | Public bucket | Public bucket | Assigned project prefix | Dept project prefix | Dept project prefix | Storage RLS policy checking prefix match |
| | INSERT | ❌ | ❌ | Assigned project prefix | Dept project prefix | Dept project prefix | Storage RLS policy verifying upload path |

---

## 3. Security Helper Implementations

```sql
-- Resolves active role for current user
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Resolves active tenant organization for current user
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Verifies project access permissions
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_org_id uuid;
BEGIN
  IF p_project_id IS NULL THEN RETURN false; END IF;
  
  v_role := public.get_current_user_role();
  v_org_id := public.get_current_user_organization_id();
  
  -- Public projects accessible to all
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND is_public = true) THEN
    RETURN true;
  END IF;
  
  -- Anonymous cannot view non-public projects
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  
  -- Government officials see department projects
  IF v_role IN ('government_admin', 'government_engineer', 'government_auditor') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = p_project_id AND government_organization_id = v_org_id
    );
  END IF;
  
  -- Contractors see projects explicitly assigned to their organization
  IF v_role IN ('contractor_admin', 'contractor_project_manager', 'contractor_site_engineer') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.project_organizations
      WHERE project_id = p_project_id
        AND organization_id = v_org_id
        AND relationship_type = 'CONTRACTOR'
    );
  END IF;
  
  RETURN false;
END;
$$;
```

---
*End of Row Level Security Policy Matrix.*
