-- 043_mfa_enforcement.sql
-- Multi-factor authentication for every government and contractor account.
--
-- Supabase Auth issues JWTs with an `aal` claim: 'aal1' after a password
-- sign-in, 'aal2' after a verified TOTP challenge. From this migration on,
-- any government or contractor user whose session is not aal2 is refused on
--   * every INSERT / UPDATE / DELETE on the core tables (restrictive RLS), and
--   * every privileged workflow function (wrappers below).
-- Citizens are unaffected. The service role (backend jobs) is unaffected.
--
-- Switch (for a staged rollout only; keep it on in production):
--   UPDATE public.platform_settings SET value = 'false' WHERE key = 'require_mfa';

INSERT INTO public.platform_settings (key, value)
VALUES ('require_mfa', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT auth.uid()) IS NULL
    OR COALESCE((public.platform_setting('require_mfa', 'true'::jsonb))::text, 'true') = 'false'
    OR COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2'
    OR NOT (public.is_government_user() OR public.is_contractor_user());
$$;
REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_mfa()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'MFA_REQUIRED: verify your authenticator code to perform this action'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_mfa() TO authenticated;

-- ---------------------------------------------------------------------------
-- Restrictive write policies (ANDed with every permissive policy)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'projects', 'project_milestones', 'project_documents', 'project_organizations',
    'tenders', 'tender_documents', 'tender_bids', 'bid_documents', 'contracts',
    'progress_updates', 'progress_evidence', 'inspections', 'inspection_findings',
    'financial_updates', 'delay_events', 'complaints',
    'environmental_clearances', 'environmental_baselines', 'environmental_commitments',
    'environmental_observations', 'environmental_incidents',
    'organization_members', 'organizations',
    'government_access_requests', 'contractor_access_requests',
    'contractor_invoices', 'project_messages', 'project_resources', 'project_workers',
    'ai_insights', 'ai_runs', 'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS mfa_required_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS mfa_required_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS mfa_required_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY mfa_required_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.mfa_satisfied())', t);
    EXECUTE format('CREATE POLICY mfa_required_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.mfa_satisfied())', t);
    EXECUTE format('CREATE POLICY mfa_required_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.mfa_satisfied())', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Wrap privileged SECURITY DEFINER workflow functions. Each function is
-- renamed to <name>_mfa_inner (no longer executable by clients) and a wrapper
-- with the original name and signature calls assert_mfa() first.
-- Idempotent: functions already wrapped are skipped.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  sig text;
  v_oid oid;
  v_name text;
  v_args text;
  v_identity text;
  v_result text;
  v_retset boolean;
  v_nargs int;
  v_call text;
  v_body text;
  sigs text[] := ARRAY[
    'public.award_contract(uuid, uuid)',
    'public.approve_progress_update(uuid, text, numeric, text)',
    'public.submit_progress_update(uuid, numeric, text, uuid)',
    'public.save_tender_bid(uuid, numeric, text, text)',
    'public.withdraw_tender_bid(uuid)',
    'public.approve_government_access_request(uuid, public.app_role_enum)',
    'public.approve_contractor_access_request(uuid, public.app_role_enum)',
    'public.reject_access_request(uuid, text, text)',
    'public.update_complaint_status(uuid, text, text)',
    'public.transfer_project_ownership(uuid, uuid)',
    'public.set_tender_committee(uuid, uuid[], uuid)',
    'public.approve_bid_opening(uuid)',
    'public.record_bid_evaluation(uuid, numeric, numeric, text)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    v_oid := to_regprocedure(sig);
    IF v_oid IS NULL THEN CONTINUE; END IF;
    SELECT p.proname, pg_get_function_arguments(p.oid),
           COALESCE((SELECT string_agg(format_type(t, NULL), ', ' ORDER BY ord)
                     FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(t, ord)), ''),
           pg_get_function_result(p.oid), p.proretset, p.pronargs
      INTO v_name, v_args, v_identity, v_result, v_retset, v_nargs
    FROM pg_proc p WHERE p.oid = v_oid;
    IF to_regprocedure(format('public.%I(%s)', v_name || '_mfa_inner', v_identity)) IS NOT NULL THEN
      CONTINUE; -- already wrapped
    END IF;

    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', v_name, v_identity, v_name || '_mfa_inner');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', v_name || '_mfa_inner', v_identity);

    SELECT string_agg('$' || i, ', ') INTO v_call FROM generate_series(1, v_nargs) i;
    v_call := format('public.%I(%s)', v_name || '_mfa_inner', COALESCE(v_call, ''));

    IF v_retset THEN
      v_body := format('BEGIN PERFORM public.assert_mfa(); RETURN QUERY SELECT * FROM %s; END;', v_call);
    ELSIF v_result = 'void' THEN
      v_body := format('BEGIN PERFORM public.assert_mfa(); PERFORM %s; END;', v_call);
    ELSE
      v_body := format('BEGIN PERFORM public.assert_mfa(); RETURN %s; END;', v_call);
    END IF;

    EXECUTE format(
      'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS %L',
      v_name, v_args, v_result, v_body);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', v_name, v_identity);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', v_name, v_identity);
  END LOOP;
END $$;
