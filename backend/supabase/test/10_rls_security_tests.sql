-- 10_rls_security_tests.sql
-- Database security regression suite. Runs against a database built with
-- apply-migrations.sh (plain PostgreSQL + 00_supabase_shim.sql). Every check
-- raises on failure; psql -v ON_ERROR_STOP=1 turns that into a non-zero exit.
--
-- Identities are simulated exactly the way PostgREST does it: SET ROLE to
-- anon / authenticated and put the JWT claims in request.jwt.claims.

\set ON_ERROR_STOP 1
SET client_min_messages TO notice;
\o /dev/null

-- ---------------------------------------------------------------------------
-- Test helpers (security invoker: they run with the caller's role)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;

CREATE OR REPLACE FUNCTION tests.count_rows(p_sql text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || p_sql || ') q' INTO n;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION tests.expect_rows(p_name text, p_sql text, p_expected bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  n := tests.count_rows(p_sql);
  IF n <> p_expected THEN
    RAISE EXCEPTION 'FAIL [%]: expected % rows, got %', p_name, p_expected, n;
  END IF;
  RAISE NOTICE 'ok   %', p_name;
END $$;

CREATE OR REPLACE FUNCTION tests.expect_affected(p_name text, p_sql text, p_expected bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> p_expected THEN
    RAISE EXCEPTION 'FAIL [%]: expected % affected rows, got %', p_name, p_expected, n;
  END IF;
  RAISE NOTICE 'ok   %', p_name;
END $$;

CREATE OR REPLACE FUNCTION tests.expect_error(p_name text, p_sql text, p_pattern text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF p_pattern IS NOT NULL AND SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FAIL [%]: wrong error: %', p_name, SQLERRM;
    END IF;
    RAISE NOTICE 'ok   % (refused: %)', p_name, left(SQLERRM, 90);
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL [%]: statement succeeded but should have been refused', p_name;
END $$;

CREATE OR REPLACE FUNCTION tests.expect_ok(p_name text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE NOTICE 'ok   %', p_name;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL [%]: %', p_name, SQLERRM;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO anon, authenticated;

-- Switch identity. aal defaults to aal2 (MFA verified).
CREATE OR REPLACE FUNCTION tests.claims(p_uid uuid, p_aal text DEFAULT 'aal2') RETURNS text
LANGUAGE sql AS $$
  SELECT json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
RESET ROLE;
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000a001', 'gov.a.admin@pmc.gov.in',  now(), '{"full_name":"Gov A Admin"}'),
  ('00000000-0000-0000-0000-00000000a002', 'gov.a.eng@pmc.gov.in',    now(), '{"full_name":"Gov A Engineer"}'),
  ('00000000-0000-0000-0000-00000000a003', 'gov.a.chief@pmc.gov.in',  now(), '{"full_name":"Gov A Chief"}'),
  ('00000000-0000-0000-0000-00000000b001', 'gov.b.admin@pmrda.gov.in',now(), '{"full_name":"Gov B Admin"}'),
  ('00000000-0000-0000-0000-00000000c001', 'x@contractor-x.com',      now(), '{"full_name":"Contractor X"}'),
  ('00000000-0000-0000-0000-00000000c002', 'y@contractor-y.com',      now(), '{"full_name":"Contractor Y"}'),
  ('00000000-0000-0000-0000-00000000d001', 'citizen.one@example.com', now(), '{"full_name":"Citizen One","phone":"9999999991"}'),
  ('00000000-0000-0000-0000-00000000d002', 'citizen.two@example.com', now(), '{"full_name":"Citizen Two","phone":"9999999992"}'),
  ('00000000-0000-0000-0000-00000000e001', 'monitor@state.gov.in',    now(), '{"full_name":"State Monitor"}'),
  ('00000000-0000-0000-0000-00000000f001', 'applicant@gmail.com',     now(), '{"full_name":"Applicant Gmail","requested_role":"government_engineer"}'),
  ('00000000-0000-0000-0000-00000000f002', 'applicant@pmc.gov.in',    now(), '{"full_name":"Applicant Gov","requested_role":"government_engineer"}');

INSERT INTO public.organizations (id, name, type, verified, is_oversight) VALUES
  ('10000000-0000-0000-0000-00000000000a', 'Gov Org A', 'government', true, false),
  ('10000000-0000-0000-0000-00000000000b', 'Gov Org B', 'government', true, false),
  ('10000000-0000-0000-0000-0000000000c1', 'Contractor X Pvt Ltd', 'contractor', true, false),
  ('10000000-0000-0000-0000-0000000000c2', 'Contractor Y Pvt Ltd', 'contractor', true, false),
  ('10000000-0000-0000-0000-0000000000e1', 'State Monitoring Cell', 'government', true, true);

INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a001', 'government_admin', 'active'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a002', 'government_engineer', 'active'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a003', 'chief_engineer', 'active'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000b001', 'government_admin', 'active'),
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c001', 'contractor_admin', 'active'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000c002', 'contractor_admin', 'active'),
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e001', 'auditor', 'active');

INSERT INTO public.projects (id, nirikshak_project_id, project_name, sector, project_authority, government_organization_id, is_public)
VALUES
  ('20000000-0000-0000-0000-00000000000a', 'NIR-TEST-A', 'Project A (private)', 'Roads', 'Gov Org A', '10000000-0000-0000-0000-00000000000a', false),
  ('20000000-0000-0000-0000-00000000000b', 'NIR-TEST-B', 'Project B (private)', 'Water', 'Gov Org B', '10000000-0000-0000-0000-00000000000b', false),
  ('20000000-0000-0000-0000-0000000000a2', 'NIR-TEST-A2', 'Project A2 (public)', 'Roads', 'Gov Org A', '10000000-0000-0000-0000-00000000000a', true);

INSERT INTO public.tenders (id, project_id, tender_number, title, issuing_organization_id, estimated_value_inr_crore, bid_due_date, status, is_public)
VALUES
  ('30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'NIR-TND-TEST-A', 'Tender A', '10000000-0000-0000-0000-00000000000a', 10, CURRENT_DATE + 5, 'PUBLISHED', true);

INSERT INTO public.tender_bids (id, tender_id, contractor_organization_id, bid_amount, status, bid_reference)
VALUES
  ('40000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000c1', 9.5, 'SUBMITTED', 'BID-X'),
  ('40000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000c2', 9.9, 'SUBMITTED', 'BID-Y');

INSERT INTO public.complaints (id, project_id, user_id, category, title, description, status)
VALUES ('50000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000d001',
        'Road', 'Pothole on main road', 'Large pothole near the school gate', 'SUBMITTED');

-- ===========================================================================
-- 1. Anonymous visitor
-- ===========================================================================
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tests.expect_error('anon cannot read profiles', 'SELECT * FROM public.profiles', 'permission denied');
SELECT tests.expect_error('anon cannot read import_batches', 'SELECT * FROM public.import_batches', 'permission denied');
SELECT tests.expect_error('anon cannot read project_import_staging', 'SELECT * FROM public.project_import_staging', 'permission denied');
SELECT tests.expect_error('anon cannot write audit_logs', $q$INSERT INTO public.audit_logs (action, entity_type) VALUES ('FORGED','x')$q$, 'permission denied');
SELECT tests.expect_error('anon cannot read complaint_updates', 'SELECT * FROM public.complaint_updates', 'permission denied');
SELECT tests.expect_error('anon cannot insert complaints directly',
  $q$INSERT INTO public.complaints (category, title, description) VALUES ('x','spam title','spam description')$q$, 'permission denied');
SELECT tests.expect_rows('anon sees only public projects', 'SELECT id FROM public.projects', 1);
SELECT tests.expect_rows('anon sees no bids', 'SELECT 1 WHERE has_table_privilege(''anon'', ''public.tender_bids'', ''SELECT'')', 0);

-- ===========================================================================
-- 2. Citizens
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000d002', 'aal1'), false);
SELECT tests.expect_rows('citizen sees only own profile', 'SELECT id FROM public.profiles', 1);
SELECT tests.expect_rows('citizen cannot see another citizen''s complaint', 'SELECT id FROM public.complaints', 0);
SELECT tests.expect_rows('citizen cannot see another citizen''s complaint updates', 'SELECT id FROM public.complaint_updates', 0);
SELECT tests.expect_error('citizen cannot forge complaint updates',
  $q$INSERT INTO public.complaint_updates (complaint_id, new_status) VALUES ('50000000-0000-0000-0000-0000000000d1','RESOLVED')$q$, 'permission denied');
SELECT tests.expect_error('citizen cannot file a complaint as someone else',
  $q$INSERT INTO public.complaints (user_id, category, title, description) VALUES ('00000000-0000-0000-0000-00000000d001','x','title here','description here')$q$,
  'row-level security');
SELECT tests.expect_error('citizen cannot act on someone else''s complaint',
  $q$SELECT public.citizen_complaint_action('50000000-0000-0000-0000-0000000000d1','ESCALATE','x')$q$, 'not found');
SELECT tests.expect_error('citizen cannot write audit_logs', $q$INSERT INTO public.audit_logs (action, entity_type) VALUES ('FORGED','x')$q$, 'permission denied');
SELECT tests.expect_error('citizen cannot read import_batches', 'SELECT * FROM public.import_batches', 'permission denied');

SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000d001', 'aal1'), false);
SELECT tests.expect_rows('complainant sees own complaint', 'SELECT id FROM public.complaints', 1);
SELECT tests.expect_ok('complainant can escalate own complaint (no MFA needed for citizens)',
  $q$SELECT public.citizen_complaint_action('50000000-0000-0000-0000-0000000000d1','ESCALATE','Nothing happened for 2 weeks')$q$);
SELECT tests.expect_rows('escalation recorded in complaint_updates with actor',
  $q$SELECT 1 FROM public.complaint_updates WHERE new_status = 'ESCALATED' AND actor_id = '00000000-0000-0000-0000-00000000d001'$q$, 1);
SELECT tests.expect_error('complainant cannot reopen an unresolved complaint',
  $q$SELECT public.citizen_complaint_action('50000000-0000-0000-0000-0000000000d1','REOPEN',NULL)$q$, 'only resolved');

-- ===========================================================================
-- 3. Contractors
-- ===========================================================================
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000c001'), false);
SELECT tests.expect_rows('contractor X sees only own bid', 'SELECT id FROM public.tender_bids', 1);
SELECT tests.expect_rows('contractor X cannot see private projects it is not assigned to', $q$SELECT id FROM public.projects WHERE is_public = false$q$, 0);
SELECT tests.expect_rows('contractor cannot see other users'' profiles', 'SELECT id FROM public.profiles', 1);

-- ===========================================================================
-- 4. Government tenancy
-- ===========================================================================
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000b001'), false);
SELECT tests.expect_rows('gov B cannot read gov A private project', $q$SELECT id FROM public.projects WHERE id = '20000000-0000-0000-0000-00000000000a'$q$, 0);
SELECT tests.expect_affected('gov B cannot update gov A project',
  $q$UPDATE public.projects SET project_name = 'hijacked' WHERE id = '20000000-0000-0000-0000-00000000000a'$q$, 0);
SELECT tests.expect_affected('gov B cannot update gov A tender',
  $q$UPDATE public.tenders SET title = 'hijacked' WHERE id = '30000000-0000-0000-0000-00000000000a'$q$, 0);
SELECT tests.expect_rows('gov B sees no bids of gov A tender', 'SELECT id FROM public.tender_bids', 0);
SELECT tests.expect_error('gov B cannot transfer gov A project',
  $q$SELECT public.transfer_project_ownership('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b')$q$, 'owning organization');
SELECT tests.expect_rows('officers can see profiles (directory)', 'SELECT id FROM public.profiles', 11);
SELECT tests.expect_error('officers cannot write audit_logs directly', $q$INSERT INTO public.audit_logs (action, entity_type) VALUES ('FORGED','x')$q$, 'permission denied');

-- Oversight: read across organizations, never write
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000e001'), false);
SELECT tests.expect_rows('oversight reads every project', 'SELECT id FROM public.projects', 3);
SELECT tests.expect_affected('oversight cannot update another org''s project',
  $q$UPDATE public.projects SET project_name = 'x' WHERE id = '20000000-0000-0000-0000-00000000000a'$q$, 0);

-- ===========================================================================
-- 5. MFA enforcement
-- ===========================================================================
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a001', 'aal1'), false);
SELECT tests.expect_rows('gov A reads own project without MFA (read-only)', $q$SELECT id FROM public.projects WHERE id = '20000000-0000-0000-0000-00000000000a'$q$, 1);
SELECT tests.expect_affected('gov A cannot write without MFA (aal1)',
  $q$UPDATE public.projects SET project_name = 'no mfa' WHERE id = '20000000-0000-0000-0000-00000000000a'$q$, 0);
SELECT tests.expect_error('privileged RPC refuses aal1 session',
  $q$SELECT public.set_tender_committee('30000000-0000-0000-0000-00000000000a', ARRAY['00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000a002']::uuid[])$q$, 'MFA_REQUIRED');
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a001', 'aal2'), false);
SELECT tests.expect_affected('gov A writes own project with MFA (aal2)',
  $q$UPDATE public.projects SET description = 'verified edit' WHERE id = '20000000-0000-0000-0000-00000000000a'$q$, 1);

-- ===========================================================================
-- 6. Sealed bids, committee opening, committee evaluation, award
-- ===========================================================================
SELECT tests.expect_rows('issuer cannot read bid rows before opening', 'SELECT id FROM public.tender_bids', 0);
SELECT tests.expect_rows('issuer can see the bid COUNT before opening',
  $q$SELECT 1 FROM public.get_tender_bid_summary('30000000-0000-0000-0000-00000000000a') WHERE submitted_bids = 2$q$, 1);
SELECT tests.expect_rows('bid amount is not in the audit trail',
  $q$SELECT 1 FROM public.audit_logs WHERE entity_type = 'tender_bids' AND (new_value ? 'amount' OR new_value ? 'bid_amount')$q$, 0);
SELECT tests.expect_error('committee must have enough members',
  $q$SELECT public.set_tender_committee('30000000-0000-0000-0000-00000000000a', ARRAY['00000000-0000-0000-0000-00000000a001']::uuid[])$q$, 'at least');
SELECT tests.expect_error('committee cannot include another organization''s officer',
  $q$SELECT public.set_tender_committee('30000000-0000-0000-0000-00000000000a', ARRAY['00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000b001']::uuid[])$q$, 'issuing organization');
SELECT tests.expect_ok('admin sets a 2-member committee',
  $q$SELECT public.set_tender_committee('30000000-0000-0000-0000-00000000000a', ARRAY['00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000a002']::uuid[], '00000000-0000-0000-0000-00000000a001')$q$);
SELECT tests.expect_error('bids cannot be opened before the due date',
  $q$SELECT public.approve_bid_opening('30000000-0000-0000-0000-00000000000a')$q$, 'due date');

RESET ROLE;
UPDATE public.tenders SET bid_due_date = CURRENT_DATE - 1 WHERE id = '30000000-0000-0000-0000-00000000000a';
SET ROLE authenticated;

SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a003'), false);
SELECT tests.expect_error('non-committee officer cannot open bids',
  $q$SELECT public.approve_bid_opening('30000000-0000-0000-0000-00000000000a')$q$, 'committee');

SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a001'), false);
SELECT tests.expect_ok('first committee key', $q$SELECT public.approve_bid_opening('30000000-0000-0000-0000-00000000000a')$q$);
SELECT tests.expect_rows('one key does not open the bids', 'SELECT id FROM public.tender_bids', 0);

SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a002'), false);
SELECT tests.expect_ok('second committee key', $q$SELECT public.approve_bid_opening('30000000-0000-0000-0000-00000000000a')$q$);
SELECT tests.expect_rows('two keys open the bids for the issuer', 'SELECT id FROM public.tender_bids', 2);

SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000b001'), false);
SELECT tests.expect_rows('opened bids stay hidden from other organizations', 'SELECT id FROM public.tender_bids', 0);

SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a001'), false);
SELECT tests.expect_ok('member 1 scores bid X',
  $q$SELECT public.record_bid_evaluation('40000000-0000-0000-0000-0000000000c1', 80, 90, 'meets all criteria')$q$);
SELECT tests.expect_error('award refused with only one evaluation',
  $q$SELECT public.award_contract('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000c1')$q$, 'committee evaluations');
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a002'), false);
SELECT tests.expect_ok('member 2 scores bid X',
  $q$SELECT public.record_bid_evaluation('40000000-0000-0000-0000-0000000000c1', 70, 80, NULL)$q$);
SELECT tests.expect_rows('combined score is committee average with tender weight (0.7*75 + 0.3*85 = 78.00)',
  $q$SELECT 1 FROM public.tender_bids WHERE id = '40000000-0000-0000-0000-0000000000c1' AND combined_score = 78.00$q$, 1);
SELECT tests.expect_error('an engineer cannot award',
  $q$SELECT public.award_contract('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000c1')$q$, 'government_admin or chief_engineer');
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a001'), false);
SELECT tests.expect_ok('admin awards after a complete committee evaluation',
  $q$SELECT public.award_contract('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000c1')$q$);
SELECT tests.expect_rows('award created an active contract for contractor X',
  $q$SELECT 1 FROM public.contracts WHERE tender_id = '30000000-0000-0000-0000-00000000000a' AND contractor_organization_id = '10000000-0000-0000-0000-0000000000c1'$q$, 1);

-- ===========================================================================
-- 7. Access approvals
-- ===========================================================================
SELECT tests.expect_rows('sign-up metadata created two pending government requests',
  $q$SELECT 1 FROM public.government_access_requests WHERE status = 'PENDING'$q$, 2);
SELECT tests.expect_error('non-government email domain cannot be approved',
  $q$SELECT public.approve_government_access_request((SELECT id FROM public.government_access_requests WHERE official_email = 'applicant@gmail.com'), 'government_engineer')$q$,
  'approved government domain');
SELECT tests.expect_ok('official-domain applicant can be approved',
  $q$SELECT public.approve_government_access_request((SELECT id FROM public.government_access_requests WHERE official_email = 'applicant@pmc.gov.in'), 'government_engineer')$q$);
SELECT tests.expect_rows('approval was audited',
  $q$SELECT 1 FROM public.audit_logs WHERE action = 'MEMBERSHIP_INSERT' AND new_value->>'user_id' = '00000000-0000-0000-0000-00000000f002'$q$, 1);

-- ===========================================================================
-- 8. Officer complaint handling
-- ===========================================================================
SELECT tests.expect_ok('officer changes complaint status with a note',
  $q$SELECT public.update_complaint_status('50000000-0000-0000-0000-0000000000d1', 'IN_PROGRESS', 'Crew dispatched')$q$);
SELECT tests.expect_rows('status change logged with officer as actor',
  $q$SELECT 1 FROM public.complaint_updates WHERE new_status = 'IN_PROGRESS' AND actor_id = '00000000-0000-0000-0000-00000000a001' AND notes = 'Crew dispatched'$q$, 1);

-- ===========================================================================
-- 8b. Storage
-- ===========================================================================
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000c001'), false);
SELECT tests.expect_ok('assigned contractor uploads progress evidence into its own folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('progress-evidence', '10000000-0000-0000-0000-0000000000c1/20000000-0000-0000-0000-00000000000a/site.jpg')$q$);
SELECT tests.expect_error('contractor cannot upload into another organization''s folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('progress-evidence', '10000000-0000-0000-0000-0000000000c2/20000000-0000-0000-0000-00000000000a/fake.jpg')$q$, 'row-level security');
SELECT tests.expect_error('contractor cannot upload evidence for a project it is not assigned to',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('progress-evidence', '10000000-0000-0000-0000-0000000000c1/20000000-0000-0000-0000-00000000000b/x.jpg')$q$, 'row-level security');
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000c002'), false);
SELECT tests.expect_rows('other contractor cannot read the evidence', $q$SELECT 1 FROM storage.objects WHERE bucket_id = 'progress-evidence'$q$, 0);
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000a002'), false);
SELECT tests.expect_rows('project owner officer reads the evidence', $q$SELECT 1 FROM storage.objects WHERE bucket_id = 'progress-evidence'$q$, 1);
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000b001'), false);
SELECT tests.expect_rows('other government org cannot read the evidence', $q$SELECT 1 FROM storage.objects WHERE bucket_id = 'progress-evidence'$q$, 0);
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000d001', 'aal1'), false);
SELECT tests.expect_ok('citizen uploads complaint evidence into own folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('complaint-evidence', '00000000-0000-0000-0000-00000000d001/pothole.jpg')$q$);
SELECT tests.expect_error('citizen cannot upload into another user''s folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('complaint-evidence', '00000000-0000-0000-0000-00000000d002/x.jpg')$q$, 'row-level security');
SELECT set_config('request.jwt.claims', tests.claims('00000000-0000-0000-0000-00000000d002', 'aal1'), false);
SELECT tests.expect_rows('citizen cannot read another citizen''s evidence', $q$SELECT 1 FROM storage.objects WHERE bucket_id = 'complaint-evidence'$q$, 0);

-- ===========================================================================
-- 9. Integrity
-- ===========================================================================
RESET ROLE;
SELECT tests.expect_error('audit_logs is append-only even for the database owner',
  $q$UPDATE public.audit_logs SET action = 'tampered'$q$, 'append-only');
SELECT tests.expect_error('audit_logs rows cannot be deleted',
  $q$DELETE FROM public.audit_logs$q$, 'append-only');
SELECT tests.expect_rows('complaint reference generated by the database',
  $q$SELECT 1 FROM public.complaints WHERE reference_number ~ '^NIR-CMP-[0-9]{4}-[0-9]{6}-[0-9A-F]{6}$'$q$, 1);
SELECT tests.expect_rows('no table in public has RLS disabled',
  $q$SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity$q$, 0);
SELECT tests.expect_rows('no permissive write policy is WITH CHECK (true)',
  $q$SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT','UPDATE','ALL') AND with_check = 'true'$q$, 0);
SELECT tests.expect_rows('every project has an owner', $q$SELECT 1 FROM public.projects WHERE government_organization_id IS NULL$q$, 0);

\echo 'ALL DATABASE SECURITY TESTS PASSED'
