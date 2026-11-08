-- ============================================================================
-- 033_dataflow_repairs.sql — repairs from the 2026-11-08 data-flow audit
-- (~/workspace/nirikshak-audit/dataflow-audit.md §3)
-- ============================================================================
-- WHAT THIS FIXES
--   DF-12  tender_bids.deleted_at exists in the live DB but in NO surviving
--          migration lineage path (shadowed 005) — add it idempotently so
--          a fresh provisioning matches live.
--   DF-20  projects.technical_approval_date — the government planning form
--          collects a technical approval date that had no column to land in.
--   DF-13  reject_access_request(uuid, text, text) is CALLED by the
--          government Access Requests page and is referenced by migrations
--          025/026, but was never CREATE'd in any migration (it exists on
--          the live DB only because it was created out-of-band).
--   DF-03  The 001 complaints SELECT policy still contains its permissive
--          `is_public OR ...` branch, so "public" complaints (the default)
--          are readable by anyone, with reporter identity attached. The
--          table policy is tightened to owner/government, and public reads
--          move to a redacted view (public_complaints_view).
--   DF-25  complaint_evidence exists in two shapes: 001 (file_path,
--          evidence_type, metadata) and shadowed 009 (storage_path,
--          file_name, file_size, mime_type). The frontend maps the 009
--          shape — add those columns without dropping the 001 ones.
--   DF-28  projects / inspections / environmental_incidents were never
--          added to the supabase_realtime publication, so the frontend's
--          subscriptions on them can never fire.
--   DF-35  government_project_summary_view (final definition in 026)
--          filters government_organization_id = caller's org with no
--          fallback, so projects whose gov-org was never backfilled are
--          invisible in the government portal. Recreated with an explicit
--          unassigned (NULL org) path.
--   DF-24  public_projects_view lacks columns the citizen/government
--          mappers read: amount_spent_inr_crore, financial_progress_percent,
--          revised_cost_inr_crore, and a plain `description` (the view only
--          exposes public_description). NOTE: the live view was extended
--          out-of-band beyond migration 017 (joins + extra columns +
--          public_visibility filter) — the DF-24 section below preserves
--          the live definition (pg_get_viewdef, 2026-11-08) and appends.
--   DF-08  (DB half) Contractors cannot withdraw a SUBMITTED bid: the
--          024 update policy only allows editing DRAFT bids, so a direct
--          update silently matches 0 rows. withdraw_tender_bid() is the
--          sanctioned path (own bid, SUBMITTED -> WITHDRAWN only).
--
-- SAFETY / IDEMPOTENCY
--   * Run ONLY AFTER migrations 001–032.
--   * All statements are guarded / CREATE OR REPLACE / DROP IF EXISTS,
--     in the style of 029_schema_repair.sql. Re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DF-12: tender_bids.deleted_at (soft-delete flag used by gov tender lists
-- and by save_tender_bid's conflict target)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tender_bids
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- DF-20 (DB half): projects.technical_approval_date
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS technical_approval_date DATE;

-- ---------------------------------------------------------------------------
-- DF-13: reject_access_request — signature (uuid, text, text) -> jsonb per
-- migration 025's ALTER FUNCTION and the generated database types.
-- Mirrors the sibling approve_*_access_request functions in 024:
-- government_admin caller check, row lock, PENDING-only transition,
-- reviewer metadata, audit log. The rejection reason has no column on the
-- request tables, so it is preserved in the audit log entry.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_access_request(
    p_request_id UUID,
    p_type TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := (SELECT auth.uid());
    v_caller_role public.app_role_enum;
    v_req_user_id UUID;
    v_req_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication is required';
    END IF;

    SELECT role INTO v_caller_role FROM public.organization_members
    WHERE user_id = v_caller_id AND status = 'active';
    IF v_caller_role IS DISTINCT FROM 'government_admin'::public.app_role_enum THEN
        RAISE EXCEPTION 'Unauthorized: Only Government Administrators can reject access requests';
    END IF;

    IF p_type = 'government' THEN
        SELECT user_id, status INTO v_req_user_id, v_req_status
        FROM public.government_access_requests
        WHERE id = p_request_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Government access request % not found', p_request_id;
        END IF;
        IF v_req_status <> 'PENDING' THEN
            RAISE EXCEPTION 'Request % has already been %', p_request_id, v_req_status;
        END IF;

        UPDATE public.government_access_requests
        SET status = 'REJECTED',
            reviewed_by = v_caller_id,
            reviewed_at = now()
        WHERE id = p_request_id;

    ELSIF p_type = 'contractor' THEN
        SELECT user_id, status INTO v_req_user_id, v_req_status
        FROM public.contractor_access_requests
        WHERE id = p_request_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Contractor access request % not found', p_request_id;
        END IF;
        IF v_req_status <> 'PENDING' THEN
            RAISE EXCEPTION 'Request % has already been %', p_request_id, v_req_status;
        END IF;

        UPDATE public.contractor_access_requests
        SET status = 'REJECTED',
            reviewed_by = v_caller_id,
            reviewed_at = now()
        WHERE id = p_request_id;

    ELSE
        RAISE EXCEPTION 'Invalid access request type: %', p_type;
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_value)
    VALUES (
        v_caller_id,
        'REJECT_ACCESS_REQUEST',
        CASE WHEN p_type = 'government' THEN 'government_access_requests' ELSE 'contractor_access_requests' END,
        p_request_id,
        jsonb_build_object(
            'rejected_user_id', v_req_user_id,
            'request_type', p_type,
            'reason', p_reason,
            'status', 'REJECTED'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'request_type', p_type,
        'user_id', v_req_user_id,
        'status', 'REJECTED'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_access_request(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_access_request(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- DF-03 (DB half): tighten the complaints SELECT policy.
-- The 001 policy `complaints_select` (is_public OR owner OR government)
-- is replaced with owner/government only. The separate 017 policy
-- ("Citizen read own complaints or public": owner OR government OR
-- assigned contractor org) is left untouched.
-- Public/landing reads go through the redacted view below instead.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS complaints_select ON public.complaints;
CREATE POLICY complaints_select ON public.complaints FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_government_user()
);

-- Redacted public projection: deliberately NO user_id and NO description,
-- so landing-page counts/listings cannot leak reporter identity or the
-- complaint narrative. (Views read with the view owner's rights, which is
-- what makes this safe to grant to anon despite the tightened table policy.)
CREATE OR REPLACE VIEW public.public_complaints_view AS
SELECT
    c.id,
    c.reference_number,
    c.project_id,
    c.category,
    c.title,
    c.severity,
    c.status,
    c.created_at
FROM public.complaints c;

GRANT SELECT ON public.public_complaints_view TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- DF-25: complaint_evidence — add the 009-lineage columns the frontend
-- maps (storage_path, file_name, file_size, mime_type). The 001 columns
-- (file_path, evidence_type, metadata) are kept for compatibility.
-- New columns are nullable: existing 001-lineage rows have no values.
-- ---------------------------------------------------------------------------
ALTER TABLE public.complaint_evidence
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- ---------------------------------------------------------------------------
-- DF-28: publish the tables the realtime service subscribes to but which
-- no migration ever added (pattern copied from 020/021).
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_table TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        EXECUTE 'CREATE PUBLICATION supabase_realtime';
    END IF;
    FOREACH v_table IN ARRAY ARRAY[
        'projects', 'inspections', 'environmental_incidents'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- DF-35: government projects view — recreate the final 026 definition,
-- adding the explicit unassigned path (government_organization_id IS NULL)
-- so unassigned projects are visible in the government portal instead of
-- silently missing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.government_project_summary_view
WITH (security_invoker = true) AS
SELECT
  p.id, p.nirikshak_project_id, p.official_project_id, p.project_name,
  p.description, p.sector, p.subsector, p.project_type, p.ministry,
  p.department, p.project_authority, p.implementing_agency,
  p.executing_agency, p.contractor_concessionaire, p.operator,
  p.ownership_type, p.procurement_mode, p.award_date, p.planned_start_date,
  p.actual_start_date, p.original_completion_date, p.revised_completion_date,
  p.actual_completion_date, p.state, p.district, p.city, p.location_text,
  p.latitude, p.longitude, p.total_cost_inr_crore, p.original_cost_inr_crore,
  p.revised_cost_inr_crore, p.amount_spent_inr_crore,
  p.physical_progress_percent, p.financial_progress_percent,
  p.reported_status, p.normalized_status, p.record_scope,
  p.current_status_verified, p.quality_score, p.duplicate_review,
  p.source_record_id, p.primary_source_url, p.is_public, p.public_summary,
  p.published_at, p.published_by, p.version, p.government_organization_id,
  p.created_by, p.created_at, p.updated_at, p.deleted_at,
  (SELECT count(*) FROM public.complaints c
    WHERE c.project_id = p.id AND c.status NOT IN ('RESOLVED', 'CLOSED')) AS open_complaints_count,
  (SELECT count(*) FROM public.progress_updates pu
    WHERE pu.project_id = p.id AND pu.verification_status = 'SUBMITTED') AS pending_progress_updates_count,
  (SELECT count(*) FROM public.inspections i
    WHERE i.project_id = p.id AND i.status = 'SCHEDULED') AS pending_inspections_count,
  (SELECT count(*) FROM public.ai_insights ai
    WHERE ai.project_id = p.id AND ai.severity = 'HIGH' AND ai.status = 'ACTIVE') AS high_risk_ai_count
FROM public.projects p
WHERE p.deleted_at IS NULL
  AND (p.government_organization_id = public.get_user_organization_id()
       OR p.government_organization_id IS NULL);

-- ---------------------------------------------------------------------------
-- DF-24 (DB half): public projects view — append the columns the mappers
-- read to the LIVE definition. (The live view no longer matches migration
-- 017: it was extended out-of-band with contracts/organizations joins,
-- approved_cost_inr_crore, contract_number, contractor_name,
-- resolved_complaints_count, created_at, and a public_visibility filter —
-- verified via pg_get_viewdef on 2026-11-08. CREATE OR REPLACE VIEW
-- requires the existing columns to keep their names/order, so the live
-- SELECT list is preserved verbatim and the new columns are appended.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_projects_view AS
SELECT
    p.id,
    p.nirikshak_project_id,
    p.official_project_id,
    p.project_name,
    COALESCE(p.public_summary, p.description) AS public_description,
    p.sector,
    p.subsector,
    p.project_authority,
    p.implementing_agency,
    COALESCE(org.name, p.contractor_concessionaire) AS contractor_concessionaire,
    p.state,
    p.district,
    p.city,
    p.location_text,
    p.latitude,
    p.longitude,
    p.total_cost_inr_crore,
    p.physical_progress_percent,
    p.normalized_status,
    p.award_date,
    p.planned_start_date,
    p.original_completion_date,
    p.revised_completion_date,
    p.actual_completion_date,
    p.current_status_verified,
    p.quality_score,
    p.primary_source_url,
    p.updated_at,
    p.approved_cost_inr_crore,
    c.contract_number,
    org.name AS contractor_name,
    (SELECT count(*) FROM public.complaints comp
      WHERE comp.project_id = p.id AND comp.status = 'RESOLVED') AS resolved_complaints_count,
    p.created_at,
    p.amount_spent_inr_crore,
    p.financial_progress_percent,
    p.revised_cost_inr_crore,
    COALESCE(p.public_summary, p.description) AS description
FROM public.projects p
LEFT JOIN public.contracts c
  ON c.project_id = p.id AND c.status IN ('ACTIVE', 'COMPLETED')
LEFT JOIN public.organizations org
  ON org.id = c.contractor_organization_id
WHERE p.public_visibility = TRUE AND p.deleted_at IS NULL;

-- Access model: this is a public projection and must execute with owner
-- rights so anon can read it (its contracts/organizations joins would
-- otherwise fail for anon, whose table grants were revoked in 026).
-- NOTE (post-apply correction): as applied to dmkh on 2026-11-08 this
-- section also ran ALTER VIEW ... SET (security_invoker = true), which
-- broke anon reads; 034_public_projects_view_access.sql resets that flag.
-- The line is removed here so a fresh provisioning lands in the final state.
GRANT SELECT ON public.public_projects_view TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- DF-08 (DB half): withdraw_tender_bid — the sanctioned withdrawal path.
-- The caller must own the bid through an active contractor organization
-- membership (same resolution as save_tender_bid in 025); only a
-- SUBMITTED bid can be withdrawn; anything else raises.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_tender_bid(p_bid_id UUID)
RETURNS public.tender_bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_org_id UUID;
    v_bid public.tender_bids%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT om.organization_id INTO v_org_id
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = v_user_id
      AND lower(om.status) = 'active'
      AND (o.type = 'contractor' OR om.role IN ('contractor_admin', 'contractor_manager', 'contractor_site_engineer'))
    LIMIT 1;
    IF v_org_id IS NULL THEN RAISE EXCEPTION 'Active contractor membership required'; END IF;

    SELECT * INTO v_bid FROM public.tender_bids
    WHERE id = p_bid_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

    IF v_bid.contractor_organization_id <> v_org_id THEN
        RAISE EXCEPTION 'Bid belongs to a different contractor organization';
    END IF;
    IF v_bid.status <> 'SUBMITTED' THEN
        RAISE EXCEPTION 'Only submitted bids can be withdrawn (current status: %)', v_bid.status;
    END IF;

    UPDATE public.tender_bids
    SET status = 'WITHDRAWN',
        withdrawn_at = now(),
        updated_at = now()
    WHERE id = p_bid_id
    RETURNING * INTO v_bid;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_value)
    VALUES (
        v_user_id,
        'BID_WITHDRAWN',
        'tender_bids',
        v_bid.id,
        jsonb_build_object(
            'tender_id', v_bid.tender_id,
            'bid_reference', v_bid.bid_reference,
            'contractor_org_id', v_org_id
        )
    );

    RETURN v_bid;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_tender_bid(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_tender_bid(UUID) TO authenticated;
