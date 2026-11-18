-- 044_access_approval_policy.sql
-- Rules for granting government access:
--   * the applicant's official email must belong to an allowed government
--     domain (platform_settings.government_email_domains, default gov.in / nic.in;
--     a domain matches itself and its sub-domains, e.g. pmc.gov.in);
--   * nobody can approve their own request;
--   * the email address on the auth account must be confirmed.
-- Edit the allowed domains with:
--   UPDATE public.platform_settings
--   SET value = '["gov.in","nic.in","maharashtra.gov.in"]'::jsonb
--   WHERE key = 'government_email_domains';

INSERT INTO public.platform_settings (key, value)
VALUES ('government_email_domains', '["gov.in", "nic.in"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_allowed_government_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(public.platform_setting('government_email_domains', '["gov.in","nic.in"]'::jsonb)) d(domain)
    WHERE lower(split_part(btrim(p_email), '@', 2)) = lower(d.domain)
       OR lower(split_part(btrim(p_email), '@', 2)) LIKE '%.' || lower(d.domain)
  );
$$;
REVOKE ALL ON FUNCTION public.is_allowed_government_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_government_email(text) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.approve_government_access_request_policy_inner(uuid, public.app_role_enum)') IS NULL THEN
    ALTER FUNCTION public.approve_government_access_request(uuid, public.app_role_enum)
      RENAME TO approve_government_access_request_policy_inner;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.approve_government_access_request_policy_inner(uuid, public.app_role_enum) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_government_access_request(
  request_id uuid,
  approved_role public.app_role_enum DEFAULT 'government_engineer'::public.app_role_enum
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.government_access_requests%ROWTYPE;
  v_confirmed timestamptz;
  v_auth_email text;
BEGIN
  SELECT * INTO v_req FROM public.government_access_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Government access request % not found', request_id USING ERRCODE = 'P0002'; END IF;
  IF v_req.user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You cannot approve your own access request' USING ERRCODE = '42501';
  END IF;
  SELECT email, email_confirmed_at INTO v_auth_email, v_confirmed FROM auth.users WHERE id = v_req.user_id;
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'The applicant has not confirmed their email address yet' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_allowed_government_email(v_auth_email) THEN
    RAISE EXCEPTION 'The applicant''s email (%) is not on an approved government domain', v_auth_email USING ERRCODE = '22023';
  END IF;
  IF approved_role NOT IN ('government_admin', 'chief_engineer', 'project_officer', 'government_engineer', 'auditor') THEN
    RAISE EXCEPTION 'Role % is not a government role', approved_role USING ERRCODE = '22023';
  END IF;
  RETURN public.approve_government_access_request_policy_inner(request_id, approved_role);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_government_access_request(uuid, public.app_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_government_access_request(uuid, public.app_role_enum) TO authenticated;

-- Contractors: no self-approval, confirmed email.
DO $$
BEGIN
  IF to_regprocedure('public.approve_contractor_access_request_policy_inner(uuid, public.app_role_enum)') IS NULL THEN
    ALTER FUNCTION public.approve_contractor_access_request(uuid, public.app_role_enum)
      RENAME TO approve_contractor_access_request_policy_inner;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.approve_contractor_access_request_policy_inner(uuid, public.app_role_enum) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_contractor_access_request(
  request_id uuid,
  approved_role public.app_role_enum DEFAULT 'contractor_admin'::public.app_role_enum
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_confirmed timestamptz;
BEGIN
  SELECT user_id INTO v_user FROM public.contractor_access_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contractor access request % not found', request_id USING ERRCODE = 'P0002'; END IF;
  IF v_user = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You cannot approve your own access request' USING ERRCODE = '42501';
  END IF;
  SELECT email_confirmed_at INTO v_confirmed FROM auth.users WHERE id = v_user;
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'The applicant has not confirmed their email address yet' USING ERRCODE = '22023';
  END IF;
  IF approved_role NOT IN ('contractor_admin', 'contractor_manager', 'contractor_engineer', 'contractor_site_engineer') THEN
    RAISE EXCEPTION 'Role % is not a contractor role', approved_role USING ERRCODE = '22023';
  END IF;
  RETURN public.approve_contractor_access_request_policy_inner(request_id, approved_role);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_contractor_access_request(uuid, public.app_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_contractor_access_request(uuid, public.app_role_enum) TO authenticated;

-- Audit trigger coverage for membership changes (who was granted what, when).
CREATE OR REPLACE FUNCTION public.audit_organization_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_organization_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    (SELECT auth.uid()),
    public.get_user_organization_id(),
    'MEMBERSHIP_' || TG_OP,
    'organization_members',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('user_id', OLD.user_id, 'organization_id', OLD.organization_id, 'role', OLD.role, 'status', OLD.status) END,
    CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('user_id', NEW.user_id, 'organization_id', NEW.organization_id, 'role', NEW.role, 'status', NEW.status) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_organization_members() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_audit_organization_members ON public.organization_members;
CREATE TRIGGER trg_audit_organization_members
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_organization_members();
