-- 042_sealed_bids_and_committee.sql
-- Sealed bidding, committee opening and committee evaluation.
--
-- Before: government users of the issuing organization could read every bid
-- (amount included) while the tender was still open, and one officer could
-- score bids and award alone, with QCBS weights fixed at 70:30.
--
-- After:
--   * Officers cannot read bid rows until the bids are OPENED.
--   * Bids can be opened only after the bid due date, only once the tender is
--     closed to bidding, and only when at least `min_opening_members` (default 2)
--     distinct members of the tender's evaluation committee have each approved
--     the opening (two-key opening).
--   * Before opening, officers see only the NUMBER of bids, via
--     get_tender_bid_summary().
--   * Each committee member scores each bid separately
--     (tender_bid_evaluations); the bid's scores are the committee average and
--     combined = w * technical + (1 - w) * financial, w = tenders.technical_weight.
--   * award_contract refuses a bid that has fewer than tenders.min_evaluators
--     committee evaluations or whose tender's bids were never opened.

ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS technical_weight numeric(4,3) NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS min_evaluators integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS min_opening_members integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS bids_opened_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.tenders ADD CONSTRAINT tenders_technical_weight_range CHECK (technical_weight >= 0 AND technical_weight <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tenders ADD CONSTRAINT tenders_min_evaluators_range CHECK (min_evaluators BETWEEN 1 AND 15);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tenders ADD CONSTRAINT tenders_min_opening_members_range CHECK (min_opening_members BETWEEN 1 AND 15);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tenders that were already awarded / under evaluation before this migration
-- are treated as opened so historical data stays visible.
UPDATE public.tenders
SET bids_opened_at = COALESCE(updated_at, now())
WHERE bids_opened_at IS NULL AND status IN ('UNDER_EVALUATION', 'AWARDED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS public.tender_committee_members (
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  committee_role text NOT NULL DEFAULT 'MEMBER' CHECK (committee_role IN ('CHAIR', 'MEMBER')),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tender_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tender_bid_opening_approvals (
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tender_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tender_bid_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.tender_bids(id) ON DELETE CASCADE,
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES auth.users(id),
  technical_score numeric(5,2) NOT NULL CHECK (technical_score BETWEEN 0 AND 100),
  financial_score numeric(5,2) NOT NULL CHECK (financial_score BETWEEN 0 AND 100),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, evaluator_id)
);

ALTER TABLE public.tender_committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_bid_opening_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_bid_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tender_committee_members, public.tender_bid_opening_approvals, public.tender_bid_evaluations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.tender_committee_members, public.tender_bid_opening_approvals, public.tender_bid_evaluations FROM authenticated;
GRANT SELECT ON public.tender_committee_members, public.tender_bid_opening_approvals, public.tender_bid_evaluations TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tender_issuer(p_tender_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_government_user() AND EXISTS (
    SELECT 1 FROM public.tenders t
    WHERE t.id = p_tender_id AND t.issuing_organization_id = public.get_user_organization_id()
  );
$$;
REVOKE ALL ON FUNCTION public.is_tender_issuer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tender_issuer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tender_committee_member(p_tender_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_tender_issuer(p_tender_id) AND EXISTS (
    SELECT 1 FROM public.tender_committee_members m
    WHERE m.tender_id = p_tender_id AND m.user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.is_tender_committee_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tender_committee_member(uuid) TO authenticated;

DROP POLICY IF EXISTS committee_select ON public.tender_committee_members;
CREATE POLICY committee_select ON public.tender_committee_members
  FOR SELECT TO authenticated USING (public.is_tender_issuer(tender_id) OR public.is_oversight_user());
DROP POLICY IF EXISTS opening_select ON public.tender_bid_opening_approvals;
CREATE POLICY opening_select ON public.tender_bid_opening_approvals
  FOR SELECT TO authenticated USING (public.is_tender_issuer(tender_id) OR public.is_oversight_user());
DROP POLICY IF EXISTS evaluations_select ON public.tender_bid_evaluations;
CREATE POLICY evaluations_select ON public.tender_bid_evaluations
  FOR SELECT TO authenticated USING (public.is_tender_issuer(tender_id) OR public.is_oversight_user());

-- ---------------------------------------------------------------------------
-- Sealed visibility on tender_bids
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Contractor view own bids, Gov view all" ON public.tender_bids;
DROP POLICY IF EXISTS bids_select ON public.tender_bids;
DROP POLICY IF EXISTS tender_bids_select_sealed ON public.tender_bids;
CREATE POLICY tender_bids_select_sealed ON public.tender_bids
  FOR SELECT TO authenticated
  USING (
    (public.is_contractor_user() AND contractor_organization_id = public.get_user_organization_id())
    OR (
      (public.is_tender_issuer(tender_id) OR public.is_oversight_user())
      AND EXISTS (SELECT 1 FROM public.tenders t WHERE t.id = tender_bids.tender_id AND t.bids_opened_at IS NOT NULL)
    )
  );

-- Government never writes bid rows directly; scores go through record_bid_evaluation().
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'tender_bids'
             AND cmd IN ('UPDATE', 'ALL', 'DELETE')
             AND policyname <> 'Contractor update own bid'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.tender_bids', r.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_tender_bid_summary(p_tender_id uuid)
RETURNS TABLE (tender_id uuid, submitted_bids integer, bids_opened_at timestamptz,
               opening_approvals integer, min_opening_members integer, committee_size integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_tender_issuer(p_tender_id) OR public.is_oversight_user()) THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.id,
         (SELECT count(*)::int FROM public.tender_bids b
           WHERE b.tender_id = t.id AND b.deleted_at IS NULL AND b.status <> 'DRAFT' AND b.status <> 'WITHDRAWN'),
         t.bids_opened_at,
         (SELECT count(*)::int FROM public.tender_bid_opening_approvals a WHERE a.tender_id = t.id),
         t.min_opening_members,
         (SELECT count(*)::int FROM public.tender_committee_members m WHERE m.tender_id = t.id)
  FROM public.tenders t WHERE t.id = p_tender_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_tender_bid_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tender_bid_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Committee management (issuing organization's government_admin / chief_engineer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tender_committee(p_tender_id uuid, p_member_ids uuid[], p_chair_id uuid DEFAULT NULL)
RETURNS SETOF public.tender_committee_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tender public.tenders%ROWTYPE;
  v_org uuid := public.get_user_organization_id();
  v_bad integer;
BEGIN
  IF NOT public.is_tender_issuer(p_tender_id) OR public.get_user_role() NOT IN ('government_admin', 'chief_engineer') THEN
    RAISE EXCEPTION 'Only a government_admin or chief_engineer of the issuing organization can set the committee' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tender FROM public.tenders WHERE id = p_tender_id FOR UPDATE;
  IF v_tender.bids_opened_at IS NOT NULL THEN
    RAISE EXCEPTION 'The committee cannot change after bids are opened' USING ERRCODE = '22023';
  END IF;
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL
     OR array_length(p_member_ids, 1) < GREATEST(v_tender.min_evaluators, v_tender.min_opening_members) THEN
    RAISE EXCEPTION 'The committee needs at least % members', GREATEST(v_tender.min_evaluators, v_tender.min_opening_members) USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_bad FROM unnest(p_member_ids) AS u(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = u.id AND om.organization_id = v_org AND lower(om.status) = 'active'
      AND om.role IN ('government_admin', 'chief_engineer', 'project_officer', 'government_engineer')
  );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Every committee member must be an active officer (not an auditor) of the issuing organization' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.tender_committee_members WHERE tender_id = p_tender_id;
  INSERT INTO public.tender_committee_members (tender_id, user_id, committee_role, added_by)
  SELECT p_tender_id, u.id, CASE WHEN u.id = p_chair_id THEN 'CHAIR' ELSE 'MEMBER' END, (SELECT auth.uid())
  FROM (SELECT DISTINCT unnest(p_member_ids) AS id) u;

  INSERT INTO public.audit_logs (actor_id, actor_organization_id, action, entity_type, entity_id, new_value)
  VALUES ((SELECT auth.uid()), v_org, 'TENDER_COMMITTEE_SET', 'tenders', p_tender_id,
          jsonb_build_object('members', to_jsonb(p_member_ids), 'chair', p_chair_id));

  RETURN QUERY SELECT * FROM public.tender_committee_members WHERE tender_id = p_tender_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_tender_committee(uuid, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tender_committee(uuid, uuid[], uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Two-key bid opening
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_bid_opening(p_tender_id uuid)
RETURNS TABLE (tender_id uuid, opening_approvals integer, min_opening_members integer, bids_opened_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tender public.tenders%ROWTYPE;
  v_count integer;
BEGIN
  IF NOT public.is_tender_committee_member(p_tender_id) THEN
    RAISE EXCEPTION 'Only a member of this tender''s evaluation committee can open bids' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tender FROM public.tenders WHERE id = p_tender_id FOR UPDATE;
  IF v_tender.bids_opened_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bids for this tender are already open' USING ERRCODE = '22023';
  END IF;
  IF v_tender.bid_due_date IS NULL OR v_tender.bid_due_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Bids cannot be opened before the bid due date has passed' USING ERRCODE = '22023';
  END IF;
  IF v_tender.status NOT IN ('PUBLISHED', 'CLOSED') THEN
    RAISE EXCEPTION 'Tender in status % cannot have its bids opened', v_tender.status USING ERRCODE = '22023';
  END IF;
  IF v_tender.status = 'PUBLISHED' THEN
    UPDATE public.tenders SET status = 'CLOSED', updated_at = now() WHERE id = p_tender_id;
  END IF;

  INSERT INTO public.tender_bid_opening_approvals (tender_id, user_id)
  VALUES (p_tender_id, (SELECT auth.uid()))
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_count FROM public.tender_bid_opening_approvals a WHERE a.tender_id = p_tender_id;

  INSERT INTO public.audit_logs (actor_id, actor_organization_id, action, entity_type, entity_id, new_value)
  VALUES ((SELECT auth.uid()), public.get_user_organization_id(), 'BID_OPENING_APPROVED', 'tenders', p_tender_id,
          jsonb_build_object('approvals', v_count, 'required', v_tender.min_opening_members));

  IF v_count >= v_tender.min_opening_members THEN
    UPDATE public.tenders SET bids_opened_at = now(), updated_at = now() WHERE id = p_tender_id;
    INSERT INTO public.audit_logs (actor_id, actor_organization_id, action, entity_type, entity_id, new_value)
    VALUES ((SELECT auth.uid()), public.get_user_organization_id(), 'BIDS_OPENED', 'tenders', p_tender_id,
            jsonb_build_object('approvals', v_count));
  END IF;

  RETURN QUERY SELECT t.id, v_count, t.min_opening_members, t.bids_opened_at FROM public.tenders t WHERE t.id = p_tender_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_bid_opening(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_bid_opening(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Committee evaluation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_bid_evaluation(
  p_bid_id uuid,
  p_technical_score numeric,
  p_financial_score numeric,
  p_remarks text DEFAULT NULL
)
RETURNS public.tender_bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bid public.tender_bids%ROWTYPE;
  v_tender public.tenders%ROWTYPE;
  v_tech numeric;
  v_fin numeric;
BEGIN
  SELECT * INTO v_bid FROM public.tender_bids WHERE id = p_bid_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_tender_committee_member(v_bid.tender_id) THEN
    RAISE EXCEPTION 'Only a member of this tender''s evaluation committee can score bids' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tender FROM public.tenders WHERE id = v_bid.tender_id FOR UPDATE;
  IF v_tender.bids_opened_at IS NULL THEN
    RAISE EXCEPTION 'Bids must be opened before they are evaluated' USING ERRCODE = '22023';
  END IF;
  IF v_bid.status NOT IN ('SUBMITTED', 'UNDER_EVALUATION') THEN
    RAISE EXCEPTION 'A bid in status % cannot be evaluated', v_bid.status USING ERRCODE = '22023';
  END IF;
  IF p_technical_score IS NULL OR p_technical_score < 0 OR p_technical_score > 100
     OR p_financial_score IS NULL OR p_financial_score < 0 OR p_financial_score > 100 THEN
    RAISE EXCEPTION 'Scores must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tender_bid_evaluations (bid_id, tender_id, evaluator_id, technical_score, financial_score, remarks)
  VALUES (p_bid_id, v_bid.tender_id, (SELECT auth.uid()), p_technical_score, p_financial_score, left(p_remarks, 4000))
  ON CONFLICT (bid_id, evaluator_id) DO UPDATE
    SET technical_score = EXCLUDED.technical_score,
        financial_score = EXCLUDED.financial_score,
        remarks = EXCLUDED.remarks,
        updated_at = now();

  SELECT avg(technical_score), avg(financial_score) INTO v_tech, v_fin
  FROM public.tender_bid_evaluations WHERE bid_id = p_bid_id;

  UPDATE public.tender_bids
  SET technical_score = round(v_tech, 2),
      financial_score = round(v_fin, 2),
      combined_score = round(v_tender.technical_weight * v_tech + (1 - v_tender.technical_weight) * v_fin, 2),
      reviewed_by = (SELECT auth.uid()),
      reviewed_at = now(),
      status = 'UNDER_EVALUATION',
      updated_at = now()
  WHERE id = p_bid_id
  RETURNING * INTO v_bid;

  IF v_tender.status IN ('PUBLISHED', 'CLOSED') THEN
    UPDATE public.tenders SET status = 'UNDER_EVALUATION', updated_at = now() WHERE id = v_tender.id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_organization_id, action, entity_type, entity_id, new_value)
  VALUES ((SELECT auth.uid()), public.get_user_organization_id(), 'BID_EVALUATED', 'tender_bids', p_bid_id,
          jsonb_build_object('tender_id', v_tender.id, 'technical_score', p_technical_score,
                             'financial_score', p_financial_score, 'committee_combined_score', v_bid.combined_score));
  RETURN v_bid;
END;
$$;
REVOKE ALL ON FUNCTION public.record_bid_evaluation(uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bid_evaluation(uuid, numeric, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- award_contract: require opened bids and a complete committee evaluation.
-- The existing implementation is kept as award_contract_unchecked and is no
-- longer callable by clients.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.award_contract_unchecked(uuid, uuid)') IS NULL THEN
    ALTER FUNCTION public.award_contract(uuid, uuid) RENAME TO award_contract_unchecked;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.award_contract_unchecked(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_contract(p_tender_id uuid, p_selected_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tender public.tenders%ROWTYPE;
  v_evals integer;
BEGIN
  SELECT * INTO v_tender FROM public.tenders WHERE id = p_tender_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tender % not found', p_tender_id USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_tender_issuer(p_tender_id) THEN
    RAISE EXCEPTION 'Unauthorized: your organization did not issue this tender' USING ERRCODE = '42501';
  END IF;
  IF public.get_user_role() NOT IN ('government_admin', 'chief_engineer') THEN
    RAISE EXCEPTION 'Only a government_admin or chief_engineer can award a contract' USING ERRCODE = '42501';
  END IF;
  IF v_tender.bids_opened_at IS NULL THEN
    RAISE EXCEPTION 'Bids must be opened by the committee before an award' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_evals FROM public.tender_bid_evaluations e
  JOIN public.tender_committee_members m ON m.tender_id = e.tender_id AND m.user_id = e.evaluator_id
  WHERE e.bid_id = p_selected_bid_id AND e.tender_id = p_tender_id;
  IF v_evals < v_tender.min_evaluators THEN
    RAISE EXCEPTION 'The selected bid has % committee evaluations; % required', v_evals, v_tender.min_evaluators USING ERRCODE = '22023';
  END IF;
  RETURN public.award_contract_unchecked(p_tender_id, p_selected_bid_id);
END;
$$;
REVOKE ALL ON FUNCTION public.award_contract(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_contract(uuid, uuid) TO authenticated;
