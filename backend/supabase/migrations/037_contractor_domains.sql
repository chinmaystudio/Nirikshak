-- ============================================================================
-- 037_contractor_domains.sql — real tables for the contractor portal domains
-- that previously existed only in browser memory (2026-11-18 rebuild)
-- ============================================================================
-- The contractor store kept workers, resources, government messages and
-- contractor invoices in useState: the UI toasted "success" and everything
-- vanished on reload. These tables give those domains a real home with the
-- same access model as the rest of the schema:
--   * project participants read via can_access_project(project_id)
--   * the assigned contractor organisation writes its own rows
--   * government users read everything and verify invoices / action messages
-- Also adds the missing contractor INSERT policy on project_documents
-- (001 gave participants SELECT and government ALL, so contractor document
-- uploads were RLS-rejected).
--
-- Run ONLY AFTER 001–036. Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- NOTE (live-DB correction, 2026-11-18): the live dmkh database does NOT
-- have belongs_to_organization(uuid) although migration 001 defines it —
-- the first apply failed on exactly that (42883) and rolled back. Org
-- membership is therefore tested inline against organization_members,
-- the same pattern save_tender_bid uses live. can_access_project(uuid),
-- is_government_user() and get_user_organization_id() were verified to
-- exist live via pg_proc before this correction.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- project_documents: contractor organisations assigned to the project may
-- add document metadata rows for their own uploads.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS documents_contractor_insert ON public.project_documents;
CREATE POLICY documents_contractor_insert ON public.project_documents
  FOR INSERT
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND public.can_access_project(project_id)
  );

-- ---------------------------------------------------------------------------
-- Project messages (contractor <-> government correspondence)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  sender_organization_id UUID REFERENCES public.organizations(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT ('NIR-MSG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'READ', 'ACTION_REQUIRED', 'RESPONDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_messages_project ON public.project_messages(project_id, created_at DESC);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_messages_select ON public.project_messages;
CREATE POLICY project_messages_select ON public.project_messages FOR SELECT
  USING (public.is_government_user() OR public.can_access_project(project_id));

DROP POLICY IF EXISTS project_messages_insert ON public.project_messages;
CREATE POLICY project_messages_insert ON public.project_messages FOR INSERT
  WITH CHECK (
    sender_user_id = (SELECT auth.uid())
    AND public.can_access_project(project_id)
  );

DROP POLICY IF EXISTS project_messages_gov_update ON public.project_messages;
CREATE POLICY project_messages_gov_update ON public.project_messages FOR UPDATE
  USING (public.is_government_user())
  WITH CHECK (public.is_government_user());

-- ---------------------------------------------------------------------------
-- Project workers (contractor-managed site workforce)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Skilled' CHECK (category IN ('Skilled', 'Unskilled', 'Supervisor')),
  work_area TEXT,
  attendance_percent NUMERIC,
  hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'TRANSFERRED')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_workers_project ON public.project_workers(project_id);

ALTER TABLE public.project_workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_workers_select ON public.project_workers;
CREATE POLICY project_workers_select ON public.project_workers FOR SELECT
  USING (public.is_government_user() OR public.can_access_project(project_id));

DROP POLICY IF EXISTS project_workers_write ON public.project_workers;
CREATE POLICY project_workers_write ON public.project_workers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  ) AND public.can_access_project(project_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  ) AND public.can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- Project resources (machinery / equipment / vehicles / materials)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Equipment' CHECK (category IN ('Machinery', 'Equipment', 'Vehicles', 'Materials')),
  quantity NUMERIC NOT NULL DEFAULT 0,
  allocated NUMERIC NOT NULL DEFAULT 0,
  used NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'units',
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'LOW_STOCK', 'IDLE')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_resources_project ON public.project_resources(project_id);

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_resources_select ON public.project_resources;
CREATE POLICY project_resources_select ON public.project_resources FOR SELECT
  USING (public.is_government_user() OR public.can_access_project(project_id));

DROP POLICY IF EXISTS project_resources_write ON public.project_resources;
CREATE POLICY project_resources_write ON public.project_resources FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  ) AND public.can_access_project(project_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  ) AND public.can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- Contractor invoices (bills raised by the contractor against a project;
-- government verifies/pays by moving status — the government budget page
-- reads these alongside financial_updates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contractor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  invoice_number TEXT NOT NULL,
  milestone_label TEXT,
  amount_inr NUMERIC NOT NULL DEFAULT 0,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_VERIFICATION', 'APPROVED', 'REJECTED', 'PAID')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_project ON public.contractor_invoices(project_id, created_at DESC);

ALTER TABLE public.contractor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contractor_invoices_select ON public.contractor_invoices;
CREATE POLICY contractor_invoices_select ON public.contractor_invoices FOR SELECT
  USING (
    public.is_government_user()
    OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  )
  );

DROP POLICY IF EXISTS contractor_invoices_write ON public.contractor_invoices;
CREATE POLICY contractor_invoices_write ON public.contractor_invoices FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  ) AND public.can_access_project(project_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = contractor_organization_id
      AND lower(om.status) = 'active'
  ) AND public.can_access_project(project_id));

DROP POLICY IF EXISTS contractor_invoices_gov_update ON public.contractor_invoices;
CREATE POLICY contractor_invoices_gov_update ON public.contractor_invoices FOR UPDATE
  USING (public.is_government_user())
  WITH CHECK (public.is_government_user());

-- Realtime: the contractor portal subscribes to its own domains.
DO $$
DECLARE v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['project_messages', 'project_workers', 'project_resources', 'contractor_invoices'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
        END IF;
    END LOOP;
END $$;
