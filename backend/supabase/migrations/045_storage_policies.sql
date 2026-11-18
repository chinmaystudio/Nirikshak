-- 045_storage_policies.sql
-- Storage access rules for the private evidence/document buckets created in
-- migration 025. Until now only tender-documents had policies, so the portals
-- could not store any file: progress photos and complaint evidence were
-- recorded as bare file names with no file behind them.
--
-- Object key conventions (first folder = owner, enforced here):
--   progress-evidence     <contractor org id>/<project id>/<file>
--   contractor-documents  <contractor org id>/<file...>
--   government-documents  <government org id>/<file...>
--   complaint-evidence    <citizen user id>/<file...>
-- Objects are immutable through the API (no UPDATE/DELETE policies).

-- Buckets (idempotent; matches 025)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('progress-evidence', 'progress-evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('contractor-documents', 'contractor-documents', false, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('government-documents', 'government-documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('complaint-evidence', 'complaint-evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_first_folder_uuid(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (string_to_array(p_name, '/'))[1]::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_second_folder_uuid(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (string_to_array(p_name, '/'))[2]::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.storage_first_folder_uuid(text), public.storage_second_folder_uuid(text) TO anon, authenticated, service_role;

-- Older broad policies found in production (created outside migrations).
-- Storage policies are permissive (OR-ed), so these would override the
-- owner-folder rules below; they are replaced.
DROP POLICY IF EXISTS "Progress Evidence Read" ON storage.objects;
DROP POLICY IF EXISTS "Progress Evidence Upload" ON storage.objects;
DROP POLICY IF EXISTS "Government Documents Access" ON storage.objects;
DROP POLICY IF EXISTS "Contractor Documents Read" ON storage.objects;
DROP POLICY IF EXISTS "Contractor Documents Upload" ON storage.objects;
DROP POLICY IF EXISTS "Complaint Evidence Read" ON storage.objects;
DROP POLICY IF EXISTS "Complaint Evidence Upload" ON storage.objects;

-- progress-evidence ---------------------------------------------------------
DROP POLICY IF EXISTS "progress evidence upload by assigned contractor" ON storage.objects;
CREATE POLICY "progress evidence upload by assigned contractor" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'progress-evidence'
    AND public.is_contractor_user()
    AND public.storage_first_folder_uuid(name) = public.get_user_organization_id()
    AND public.can_access_project(public.storage_second_folder_uuid(name))
    AND public.mfa_satisfied()
  );

DROP POLICY IF EXISTS "progress evidence read" ON storage.objects;
CREATE POLICY "progress evidence read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress-evidence'
    AND (
      (public.is_contractor_user() AND public.storage_first_folder_uuid(name) = public.get_user_organization_id())
      OR (public.is_government_user() AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.storage_second_folder_uuid(name)
              AND p.government_organization_id = public.get_user_organization_id()))
      OR public.is_oversight_user()
    )
  );

-- contractor-documents ------------------------------------------------------
DROP POLICY IF EXISTS "contractor documents upload" ON storage.objects;
CREATE POLICY "contractor documents upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contractor-documents'
    AND public.is_contractor_user()
    AND public.storage_first_folder_uuid(name) = public.get_user_organization_id()
    AND public.mfa_satisfied()
  );
DROP POLICY IF EXISTS "contractor documents read" ON storage.objects;
CREATE POLICY "contractor documents read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contractor-documents'
    AND (
      (public.is_contractor_user() AND public.storage_first_folder_uuid(name) = public.get_user_organization_id())
      OR public.is_government_user()
    )
  );

-- government-documents ------------------------------------------------------
DROP POLICY IF EXISTS "government documents upload" ON storage.objects;
CREATE POLICY "government documents upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'government-documents'
    AND public.is_government_user()
    AND public.get_user_role() <> 'auditor'
    AND public.storage_first_folder_uuid(name) = public.get_user_organization_id()
    AND public.mfa_satisfied()
  );
DROP POLICY IF EXISTS "government documents read" ON storage.objects;
CREATE POLICY "government documents read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'government-documents'
    AND public.is_government_user()
    AND (public.storage_first_folder_uuid(name) = public.get_user_organization_id() OR public.is_oversight_user())
  );

-- complaint-evidence --------------------------------------------------------
DROP POLICY IF EXISTS "complaint evidence upload by complainant" ON storage.objects;
CREATE POLICY "complaint evidence upload by complainant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-evidence'
    AND public.storage_first_folder_uuid(name) = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS "complaint evidence read" ON storage.objects;
CREATE POLICY "complaint evidence read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-evidence'
    AND (public.storage_first_folder_uuid(name) = (SELECT auth.uid()) OR public.is_government_user())
  );
