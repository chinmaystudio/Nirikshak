-- 040_rls_gap_closure.sql
-- Closes Row Level Security gaps found by replaying migrations 001..039 on an
-- empty database and listing every permissive policy (see
-- supabase/test/audit_live_policies.sql to run the same check on production).
--
--   * import_batches / project_import_staging had RLS disabled: anyone holding
--     the public anon key could read and write them through the Data API.
--   * profiles were readable by everyone (full name + phone of every user).
--   * audit_logs accepted INSERTs from any role (forgeable audit trail).
--   * complaint_updates were world-readable (internal investigator notes) and
--     world-writable (forgeable status history).
--   * complaints accepted direct INSERTs with any status / owner.
--
-- Idempotent: safe to run on a database where some of this already exists.

-- ---------------------------------------------------------------------------
-- 1. Staging / import tables: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_import_staging ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_batches FROM anon, authenticated;
REVOKE ALL ON public.project_import_staging FROM anon, authenticated;
-- No policies: with RLS enabled and no policy only service_role (BYPASSRLS) can access.

-- ---------------------------------------------------------------------------
-- 2. Profiles: self, government officers, and members of the same organization
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_government_user()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members me
      JOIN public.organization_members them ON them.organization_id = me.organization_id
      WHERE me.user_id = (SELECT auth.uid())
        AND lower(me.status) = 'active'
        AND them.user_id = profiles.id
    )
  );
REVOKE SELECT ON public.profiles FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Audit logs: written only by SECURITY DEFINER functions / triggers / the
--    service role; never directly by clients. Append-only for everyone.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated;
REVOKE SELECT ON public.audit_logs FROM anon;

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_government_user());

CREATE OR REPLACE FUNCTION public.audit_logs_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (attempted %)', TG_OP
    USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only();

-- Sealed-bid protection inside the audit trail: bid amounts must not become
-- readable to officers through audit rows before the bids are opened. The
-- amount is replaced by a SHA-256 commitment (amount + bid reference) so the
-- submitted figure can still be proven later without being disclosed now.
CREATE OR REPLACE FUNCTION public.audit_logs_redact_sealed_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_amount text;
BEGIN
  IF NEW.entity_type = 'tender_bids' THEN
    IF NEW.new_value ? 'amount' OR NEW.new_value ? 'bid_amount' THEN
      v_amount := COALESCE(NEW.new_value->>'amount', NEW.new_value->>'bid_amount');
      NEW.new_value := (NEW.new_value - 'amount' - 'bid_amount' - 'financial_proposal')
        || jsonb_build_object(
             'amount_commitment_sha256',
             encode(extensions.digest(v_amount || ':' || COALESCE(NEW.new_value->>'bid_reference', NEW.entity_id::text), 'sha256'), 'hex')
           );
    END IF;
    IF NEW.old_value IS NOT NULL THEN
      NEW.old_value := NEW.old_value - 'amount' - 'bid_amount' - 'financial_proposal';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_logs_redact_sealed ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_redact_sealed
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_redact_sealed_values();

-- ---------------------------------------------------------------------------
-- 4. Complaints: direct client inserts are no longer accepted. Filing goes
--    through the backend (validation, sanitisation, bot protection), which
--    uses the service role.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert complaint" ON public.complaints;
DROP POLICY IF EXISTS complaints_insert_own ON public.complaints;
CREATE POLICY complaints_insert_own ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'SUBMITTED');
REVOKE INSERT, UPDATE, DELETE ON public.complaints FROM anon;

-- Reference numbers are generated by the database: sequence + random suffix,
-- unique. Replaces Math.random() 6-digit numbers (collisions, enumerable).
CREATE SEQUENCE IF NOT EXISTS public.complaint_reference_seq;
CREATE OR REPLACE FUNCTION public.next_complaint_reference()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT 'NIR-CMP-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('public.complaint_reference_seq')::text, 6, '0') || '-'
         || upper(encode(extensions.gen_random_bytes(3), 'hex'));
$$;
ALTER TABLE public.complaints ALTER COLUMN reference_number SET DEFAULT public.next_complaint_reference();
CREATE UNIQUE INDEX IF NOT EXISTS complaints_reference_number_key ON public.complaints (reference_number);

-- ---------------------------------------------------------------------------
-- 5. Complaint updates: readable by the complainant, officers and the assigned
--    contractor; written only by triggers / definer functions.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS complaint_updates_select ON public.complaint_updates;
DROP POLICY IF EXISTS complaint_updates_insert ON public.complaint_updates;
CREATE POLICY complaint_updates_select ON public.complaint_updates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_updates.complaint_id
        AND (
          c.user_id = (SELECT auth.uid())
          OR public.is_government_user()
          OR (public.is_contractor_user() AND c.assigned_organization_id = public.get_user_organization_id())
        )
    )
  );
REVOKE ALL ON public.complaint_updates FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.complaint_updates FROM authenticated;

-- Every status change on a complaint is logged automatically with the real actor.
CREATE OR REPLACE FUNCTION public.log_complaint_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_updates (complaint_id, actor_id, previous_status, new_status, notes)
    VALUES (NEW.id, (SELECT auth.uid()), OLD.status, NEW.status,
            NULLIF(current_setting('nirikshak.complaint_note', true), ''));
    IF NEW.status = 'RESOLVED' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_complaint_status_change ON public.complaints;
CREATE TRIGGER trg_log_complaint_status_change
  BEFORE UPDATE OF status ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.log_complaint_status_change();
REVOKE ALL ON FUNCTION public.log_complaint_status_change() FROM PUBLIC, anon, authenticated;

-- Officers / assigned contractor change status with an optional note.
CREATE OR REPLACE FUNCTION public.update_complaint_status(
  p_complaint_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS public.complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.complaints%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REJECTED') THEN
    RAISE EXCEPTION 'Invalid complaint status %', p_status USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.complaints WHERE id = p_complaint_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (
    public.is_government_user()
    OR (public.is_contractor_user() AND v_row.assigned_organization_id = public.get_user_organization_id())
  ) THEN
    RAISE EXCEPTION 'Not permitted to change this complaint' USING ERRCODE = '42501';
  END IF;
  IF public.get_user_role() = 'auditor' THEN
    RAISE EXCEPTION 'Auditors have read-only access' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('nirikshak.complaint_note', left(COALESCE(p_note, ''), 2000), true);
  UPDATE public.complaints SET status = p_status WHERE id = p_complaint_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.update_complaint_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_complaint_status(uuid, text, text) TO authenticated;

-- Citizens act on their own complaints: escalate, reopen, confirm resolution,
-- leave feedback. Transitions are restricted.
CREATE OR REPLACE FUNCTION public.citizen_complaint_action(
  p_complaint_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS public.complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.complaints%ROWTYPE;
  v_target text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.complaints WHERE id = p_complaint_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_row.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Complaint not found' USING ERRCODE = 'P0002';
  END IF;

  v_target := CASE p_action
    WHEN 'ESCALATE' THEN 'ESCALATED'
    WHEN 'REOPEN' THEN 'SUBMITTED'
    WHEN 'CONFIRM_RESOLVED' THEN 'RESOLVED'
    WHEN 'FEEDBACK' THEN v_row.status
    ELSE NULL END;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Invalid action %', p_action USING ERRCODE = '22023'; END IF;
  IF p_action = 'REOPEN' AND v_row.status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED') THEN
    RAISE EXCEPTION 'Only resolved or closed complaints can be reopened' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'ESCALATE' AND v_row.status IN ('RESOLVED', 'CLOSED') THEN
    RAISE EXCEPTION 'Resolved complaints cannot be escalated; reopen it instead' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'FEEDBACK' THEN
    INSERT INTO public.complaint_updates (complaint_id, actor_id, previous_status, new_status, notes)
    VALUES (v_row.id, (SELECT auth.uid()), v_row.status, v_row.status, left(COALESCE(p_note, ''), 2000));
    RETURN v_row;
  END IF;

  PERFORM set_config('nirikshak.complaint_note', left(COALESCE(p_note, ''), 2000), true);
  UPDATE public.complaints SET status = v_target WHERE id = p_complaint_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.citizen_complaint_action(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.citizen_complaint_action(uuid, text, text) TO authenticated;

-- Complaint evidence: only the complainant may attach, only to their own complaint.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'complaint_evidence' AND cmd IN ('INSERT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.complaint_evidence', r.policyname);
  END LOOP;
END $$;
CREATE POLICY complaint_evidence_insert_own ON public.complaint_evidence
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_evidence.complaint_id AND c.user_id = (SELECT auth.uid())
  ));
REVOKE INSERT, UPDATE, DELETE ON public.complaint_evidence FROM anon;

-- ---------------------------------------------------------------------------
-- 6. One active organization membership per user. Several active rows made
--    get_user_organization_id() (LIMIT 1, no ORDER BY) nondeterministic.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT user_id FROM public.organization_members
    WHERE lower(status) = 'active' GROUP BY user_id HAVING count(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    -- Keep the newest active membership, mark older duplicates inactive.
    UPDATE public.organization_members om
    SET status = 'inactive', updated_at = now()
    WHERE lower(om.status) = 'active'
      AND EXISTS (
        SELECT 1 FROM public.organization_members newer
        WHERE newer.user_id = om.user_id
          AND lower(newer.status) = 'active'
          AND (newer.created_at, newer.id) > (om.created_at, om.id)
      );
    RAISE NOTICE '040: deactivated older duplicate active memberships for % users', v_dupes;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_active_per_user
  ON public.organization_members (user_id) WHERE lower(status) = 'active';
