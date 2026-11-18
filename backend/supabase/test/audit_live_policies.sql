-- audit_live_policies.sql
-- Read-only. Paste into the Supabase SQL editor of the PRODUCTION project to
-- list the access-control problems that migrations 040-044 fix. Run it before
-- applying them (to see what is exposed) and after (every section should be empty).

-- 1. Tables in public with Row Level Security disabled (fully exposed to the anon key)
SELECT 'RLS disabled' AS problem, c.relname AS object, NULL AS detail
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
-- 2. Permissive policies that let anyone write
SELECT 'write policy WITH CHECK (true)', tablename || '.' || policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'UPDATE', 'ALL') AND with_check = 'true'
UNION ALL
-- 3. Policies readable by everyone on tables that hold personal or internal data
SELECT 'SELECT USING (true) on sensitive table', tablename || '.' || policyname, NULL
FROM pg_policies
WHERE schemaname = 'public' AND cmd = 'SELECT' AND qual = 'true'
  AND tablename IN ('profiles', 'complaint_updates', 'complaints', 'audit_logs', 'organization_members', 'tender_bids')
UNION ALL
-- 4. Policies that grant access when the owning organization is NULL
SELECT 'NULL-owner branch', tablename || '.' || policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ~ '(government_organization_id|issuing_organization_id) IS NULL'
       OR with_check ~ '(government_organization_id|issuing_organization_id) IS NULL')
UNION ALL
-- 5. Rows without an owner
SELECT 'project without owner', count(*)::text, NULL FROM public.projects WHERE government_organization_id IS NULL HAVING count(*) > 0
UNION ALL
SELECT 'tender without issuer', count(*)::text, NULL FROM public.tenders WHERE issuing_organization_id IS NULL HAVING count(*) > 0
UNION ALL
-- 6. Users with more than one active membership
SELECT 'multiple active memberships', user_id::text, count(*)::text
FROM public.organization_members WHERE lower(status) = 'active' GROUP BY user_id HAVING count(*) > 1
UNION ALL
-- 7. Seeded test / demo accounts that must not exist in production
SELECT 'test or demo account', email, id::text
FROM auth.users
WHERE email ILIKE '%@nirikshak.local' OR email ILIKE '%test%' OR email = 'government@gmail.com'
ORDER BY 1, 2;
