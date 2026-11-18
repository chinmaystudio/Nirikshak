-- 041_tenant_ownership.sql
-- Every project and tender gets an owning government organization.
--
-- Before this migration, RLS policies, can_manage_project(), can_access_project()
-- and the backend allowed ANY government organization to read and write a
-- project or tender whose government_organization_id / issuing_organization_id
-- was NULL. The imported registry was loaded with NULL owners, so in practice
-- most of the registry was writable by every government organization.
--
-- What this migration does:
--   1. Adds platform_settings (key/value) and organizations.is_oversight.
--   2. Backfills owners: exact (case-insensitive) match of
--      projects.project_authority to a government-type organization name;
--      everything still unowned goes to the "Nirikshak Platform Administration"
--      organization (created if missing, flagged as oversight).
--   3. Tenders inherit the owner of their project.
--   4. Makes both columns NOT NULL, so every "... OR x IS NULL" branch in older
--      policies becomes dead code, and rewrites the helper functions without it.
--   5. Oversight organizations (state monitoring cell, auditors' office) get
--      READ access to every project/tender/contract/progress row; writes stay
--      with the owning organization.
--
-- After applying: move projects to their real authority with
--   SELECT public.transfer_project_ownership('<project uuid>', '<org uuid>');
-- (government_admin of the current owner or of an oversight org), and add the
-- operating department's officers to the right organizations.

-- ---------------------------------------------------------------------------
-- 1. Settings and oversight flag
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;
GRANT SELECT ON public.platform_settings TO authenticated;
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.platform_setting(p_key text, p_default jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT value FROM public.platform_settings WHERE key = p_key), p_default);
$$;
REVOKE ALL ON FUNCTION public.platform_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_setting(text, jsonb) TO authenticated, service_role;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_oversight boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_oversight_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = (SELECT auth.uid())
      AND lower(om.status) = 'active'
      AND o.is_oversight
      AND om.role IN ('government_admin', 'chief_engineer', 'project_officer', 'government_engineer', 'auditor')
  );
$$;
REVOKE ALL ON FUNCTION public.is_oversight_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_oversight_user() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2/3. Backfill owners
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_platform_org uuid;
  v_matched integer := 0;
  v_fallback integer := 0;
  v_tenders integer := 0;
BEGIN
  -- Exact authority-name match to an existing government-side organization
  UPDATE public.projects p
  SET government_organization_id = o.id
  FROM public.organizations o
  WHERE p.government_organization_id IS NULL
    AND o.type IN ('government', 'authority', 'ULB', 'PSU')
    AND lower(btrim(o.name)) = lower(btrim(p.project_authority));
  GET DIAGNOSTICS v_matched = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM public.projects WHERE government_organization_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.tenders t JOIN public.projects p ON p.id = t.project_id
                WHERE t.issuing_organization_id IS NULL AND p.government_organization_id IS NULL) THEN
    SELECT id INTO v_platform_org FROM public.organizations
    WHERE name = 'Nirikshak Platform Administration' LIMIT 1;
    IF v_platform_org IS NULL THEN
      INSERT INTO public.organizations (name, type, verified, is_oversight, department)
      VALUES ('Nirikshak Platform Administration', 'government', true, true, 'Platform administration')
      RETURNING id INTO v_platform_org;
    END IF;
    UPDATE public.projects SET government_organization_id = v_platform_org
    WHERE government_organization_id IS NULL;
    GET DIAGNOSTICS v_fallback = ROW_COUNT;
  END IF;

  UPDATE public.tenders t
  SET issuing_organization_id = p.government_organization_id
  FROM public.projects p
  WHERE p.id = t.project_id AND t.issuing_organization_id IS NULL;
  GET DIAGNOSTICS v_tenders = ROW_COUNT;

  UPDATE public.tenders SET government_organization_id = issuing_organization_id
  WHERE government_organization_id IS NULL;

  IF v_platform_org IS NOT NULL THEN
    INSERT INTO public.platform_settings (key, value)
    VALUES ('platform_organization_id', to_jsonb(v_platform_org::text))
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RAISE NOTICE '041: projects matched by authority name: %, assigned to platform administration: %, tenders backfilled: %',
    v_matched, v_fallback, v_tenders;
END $$;

ALTER TABLE public.projects ALTER COLUMN government_organization_id SET NOT NULL;
ALTER TABLE public.tenders ALTER COLUMN issuing_organization_id SET NOT NULL;

-- New tenders inherit their project's owner when the caller omits it.
CREATE OR REPLACE FUNCTION public.set_tender_issuing_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.issuing_organization_id IS NULL THEN
    SELECT government_organization_id INTO NEW.issuing_organization_id
    FROM public.projects WHERE id = NEW.project_id;
  END IF;
  IF NEW.government_organization_id IS NULL THEN
    NEW.government_organization_id := NEW.issuing_organization_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_tender_issuing_org ON public.tenders;
CREATE TRIGGER trg_set_tender_issuing_org
  BEFORE INSERT ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.set_tender_issuing_org();
REVOKE ALL ON FUNCTION public.set_tender_issuing_org() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Helper functions without the NULL-owner branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_project(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_id
      AND public.is_government_user()
      AND p.government_organization_id = public.get_user_organization_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.get_user_organization_id();
BEGIN
  IF public.is_government_user() THEN
    RETURN public.is_oversight_user() OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_id AND p.government_organization_id = v_org_id
    );
  END IF;

  IF public.is_contractor_user() THEN
    RETURN EXISTS (
      SELECT 1 FROM public.project_organizations po
      WHERE po.project_id = p_id AND po.organization_id = v_org_id
    ) OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.project_id = p_id AND c.contractor_organization_id = v_org_id
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_id AND p.is_public = TRUE AND p.deleted_at IS NULL
  );
END;
$$;

-- Rewrite the policies that carried the NULL branch (now dead, but kept
-- explicit so a future DROP NOT NULL cannot silently reopen the hole).
DROP POLICY IF EXISTS "Projects select policy" ON public.projects;
CREATE POLICY "Projects select policy" ON public.projects
  FOR SELECT
  USING (
    (is_public = true AND deleted_at IS NULL)
    OR (public.is_government_user() AND government_organization_id = public.get_user_organization_id())
    OR (public.is_contractor_user() AND public.can_access_project(id))
  );

DROP POLICY IF EXISTS "Government can update projects" ON public.projects;
CREATE POLICY "Government can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_government_user() AND government_organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_government_user() AND government_organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Tenders select policy" ON public.tenders;
CREATE POLICY "Tenders select policy" ON public.tenders
  FOR SELECT
  USING (
    (is_public = true AND deleted_at IS NULL)
    OR (public.is_government_user() AND issuing_organization_id = public.get_user_organization_id())
  );

DROP POLICY IF EXISTS "Government manage tenders" ON public.tenders;
CREATE POLICY "Government manage tenders" ON public.tenders
  FOR ALL TO authenticated
  USING (public.is_government_user() AND issuing_organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_government_user() AND issuing_organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
  FOR SELECT
  USING (
    (public.is_contractor_user() AND contractor_organization_id = public.get_user_organization_id())
    OR (public.is_government_user() AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = contracts.project_id AND p.government_organization_id = public.get_user_organization_id()))
  );

DROP POLICY IF EXISTS contracts_gov_all ON public.contracts;
CREATE POLICY contracts_gov_all ON public.contracts
  FOR ALL TO authenticated
  USING (public.is_government_user() AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = contracts.project_id AND p.government_organization_id = public.get_user_organization_id()))
  WITH CHECK (public.is_government_user() AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = contracts.project_id AND p.government_organization_id = public.get_user_organization_id()));

DROP POLICY IF EXISTS "Progress updates select" ON public.progress_updates;
CREATE POLICY "Progress updates select" ON public.progress_updates
  FOR SELECT
  USING (
    (public.is_contractor_user() AND contractor_organization_id = public.get_user_organization_id())
    OR (public.is_government_user() AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = progress_updates.project_id AND p.government_organization_id = public.get_user_organization_id()))
    OR (verification_status = 'APPROVED' AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = progress_updates.project_id AND p.is_public = true))
  );

DROP POLICY IF EXISTS "Government update progress" ON public.progress_updates;
CREATE POLICY "Government update progress" ON public.progress_updates
  FOR UPDATE TO authenticated
  USING (public.is_government_user() AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = progress_updates.project_id AND p.government_organization_id = public.get_user_organization_id()));

-- ---------------------------------------------------------------------------
-- 5. Oversight: read-only, across organizations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS oversight_read_projects ON public.projects;
CREATE POLICY oversight_read_projects ON public.projects
  FOR SELECT TO authenticated USING (public.is_oversight_user());
DROP POLICY IF EXISTS oversight_read_tenders ON public.tenders;
CREATE POLICY oversight_read_tenders ON public.tenders
  FOR SELECT TO authenticated USING (public.is_oversight_user());
DROP POLICY IF EXISTS oversight_read_contracts ON public.contracts;
CREATE POLICY oversight_read_contracts ON public.contracts
  FOR SELECT TO authenticated USING (public.is_oversight_user());
DROP POLICY IF EXISTS oversight_read_progress ON public.progress_updates;
CREATE POLICY oversight_read_progress ON public.progress_updates
  FOR SELECT TO authenticated USING (public.is_oversight_user());

-- ---------------------------------------------------------------------------
-- Ownership transfer (the sanctioned way to move a project to its authority)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_project_ownership(p_project_id uuid, p_new_org_id uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_old uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.get_user_role() <> 'government_admin' THEN
    RAISE EXCEPTION 'Only a government_admin can transfer project ownership' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002'; END IF;
  IF v_project.government_organization_id <> public.get_user_organization_id() AND NOT public.is_oversight_user() THEN
    RAISE EXCEPTION 'Only the owning organization or an oversight organization can transfer this project' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_new_org_id AND type IN ('government', 'authority', 'ULB', 'PSU')) THEN
    RAISE EXCEPTION 'Target must be a government organization' USING ERRCODE = '22023';
  END IF;
  v_old := v_project.government_organization_id;
  UPDATE public.projects SET government_organization_id = p_new_org_id, updated_at = now()
  WHERE id = p_project_id RETURNING * INTO v_project;
  UPDATE public.tenders SET issuing_organization_id = p_new_org_id, government_organization_id = p_new_org_id, updated_at = now()
  WHERE project_id = p_project_id AND status NOT IN ('AWARDED', 'CANCELLED');
  INSERT INTO public.audit_logs (actor_id, actor_organization_id, action, entity_type, entity_id, old_value, new_value)
  VALUES ((SELECT auth.uid()), public.get_user_organization_id(), 'PROJECT_OWNERSHIP_TRANSFER', 'projects', p_project_id,
          jsonb_build_object('government_organization_id', v_old),
          jsonb_build_object('government_organization_id', p_new_org_id));
  RETURN v_project;
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_project_ownership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_project_ownership(uuid, uuid) TO authenticated;
