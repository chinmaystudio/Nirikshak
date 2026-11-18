-- 046_public_views_read_only.sql
-- The public projection views run with their owner's rights (they bypass RLS
-- by design, to show a curated column set) but had been granted INSERT,
-- UPDATE and DELETE to anon/authenticated. public_complaints_view is a
-- simple single-table view, so it was auto-updatable: anyone with the public
-- key could change complaint rows through it (verified on production
-- 2026-11-19 in a rolled-back transaction). Views become read-only.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['public_complaints_view', 'public_projects_view', 'government_project_summary_view', 'contractor_assigned_projects_view'] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM PUBLIC, anon, authenticated', v);
    END IF;
  END LOOP;
END $$;

-- Pin search_path on trigger helpers flagged by the Supabase linter.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('prevent_hard_delete', 'validate_status_transition')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
