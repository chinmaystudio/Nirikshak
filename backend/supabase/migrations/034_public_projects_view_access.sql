-- ============================================================================
-- 034_public_projects_view_access.sql — follow-up to 033 (DF-24)
-- ============================================================================
-- 033 set security_invoker = true on public_projects_view (carrying over
-- an assumption from 026). With invoker rights, the view's contracts /
-- organizations joins execute as the CALLER — and anon/authenticated have
-- no SELECT on contracts (revoked in 026), so the public portal's reads
-- failed with "permission denied for table contracts".
--
-- This view is a deliberate PUBLIC projection (public_visibility = TRUE
-- filter, public-safe columns only), the same pattern as
-- public_complaints_view in 033: it must execute with owner rights.
-- Resetting the option restores the pre-033 behaviour.
--
-- Applied to the live dmkh database on 2026-11-08, immediately after 033.
-- ============================================================================

ALTER VIEW public.public_projects_view RESET (security_invoker);

-- Re-assert the public read grants (idempotent).
GRANT SELECT ON public.public_projects_view TO anon, authenticated;
