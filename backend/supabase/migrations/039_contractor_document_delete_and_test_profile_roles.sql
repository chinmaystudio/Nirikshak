-- ============================================================================
-- 039_contractor_document_delete_and_test_profile_roles.sql
-- (2026-11-18 handover-readiness fixes from the contractor E2E sweep)
-- ============================================================================
-- 1) Contractors could insert document metadata (migration 037) and read
--    it back, but no DELETE policy existed for them: a contractor's DELETE
--    on project_documents returned HTTP 200 while silently deleting
--    nothing (RLS filtered every row out). A contractor must be able to
--    remove document rows THEY uploaded to projects they can access.
--    Government keeps its ALL policy from migration 001.
--
-- 2) The seeded government/contractor test accounts carry
--    profiles.role = 'citizen' from the original seed, although their
--    organisation memberships (the actual authorisation source, verified
--    live) are government_admin / contractor_admin. Align the profile
--    role labels for those two test accounts only, so the handover demo
--    accounts read consistently everywhere a profile role is displayed.
--
-- Run ONLY AFTER 001-038. Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS documents_contractor_delete ON public.project_documents;
CREATE POLICY documents_contractor_delete ON public.project_documents
  FOR DELETE
  USING (
    uploaded_by = (SELECT auth.uid())
    AND public.can_access_project(project_id)
  );

UPDATE public.profiles p
SET role = 'government_admin'
FROM auth.users u
WHERE u.id = p.id
  AND u.email = 'government.test@nirikshak.local'
  AND p.role IS DISTINCT FROM 'government_admin';

UPDATE public.profiles p
SET role = 'contractor_admin'
FROM auth.users u
WHERE u.id = p.id
  AND u.email = 'contractor.test@nirikshak.local'
  AND p.role IS DISTINCT FROM 'contractor_admin';
