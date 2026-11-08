-- ============================================================================
-- 035_public_projects_view_dedupe.sql — one row per project in the public
-- projects view (follow-up to 033/034)
-- ============================================================================
-- The live public_projects_view joins contracts directly, so a project
-- with two ACTIVE/COMPLETED contracts appears TWICE in the citizen
-- portal (verified 2026-11-08: the view returned 3,934 rows for ~3,921
-- projects, with the same project id repeated back-to-back).
--
-- Fix: join only the LATEST contract per project (LATERAL ... LIMIT 1).
-- Column names, order and types are unchanged — the only behavioural
-- difference is that each project now appears exactly once, with the
-- contract_number / contractor_name of its most recent contract.
--
-- Run ONLY AFTER 033/034. Idempotent (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE VIEW public.public_projects_view AS
SELECT
    p.id,
    p.nirikshak_project_id,
    p.official_project_id,
    p.project_name,
    COALESCE(p.public_summary, p.description) AS public_description,
    p.sector,
    p.subsector,
    p.project_authority,
    p.implementing_agency,
    COALESCE(org.name, p.contractor_concessionaire) AS contractor_concessionaire,
    p.state,
    p.district,
    p.city,
    p.location_text,
    p.latitude,
    p.longitude,
    p.total_cost_inr_crore,
    p.physical_progress_percent,
    p.normalized_status,
    p.award_date,
    p.planned_start_date,
    p.original_completion_date,
    p.revised_completion_date,
    p.actual_completion_date,
    p.current_status_verified,
    p.quality_score,
    p.primary_source_url,
    p.updated_at,
    p.approved_cost_inr_crore,
    c.contract_number,
    org.name AS contractor_name,
    (SELECT count(*) FROM public.complaints comp
      WHERE comp.project_id = p.id AND comp.status = 'RESOLVED') AS resolved_complaints_count,
    p.created_at,
    p.amount_spent_inr_crore,
    p.financial_progress_percent,
    p.revised_cost_inr_crore,
    COALESCE(p.public_summary, p.description) AS description
FROM public.projects p
LEFT JOIN LATERAL (
    SELECT c2.contract_number, c2.contractor_organization_id
    FROM public.contracts c2
    WHERE c2.project_id = p.id
      AND c2.status IN ('ACTIVE', 'COMPLETED')
    ORDER BY c2.award_date DESC NULLS LAST, c2.created_at DESC
    LIMIT 1
) c ON true
LEFT JOIN public.organizations org
  ON org.id = c.contractor_organization_id
WHERE p.public_visibility = TRUE AND p.deleted_at IS NULL;

GRANT SELECT ON public.public_projects_view TO anon, authenticated;
