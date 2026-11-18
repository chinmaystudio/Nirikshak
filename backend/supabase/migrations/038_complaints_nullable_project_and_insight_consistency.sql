-- ============================================================================
-- 038_complaints_nullable_project_and_insight_consistency.sql
-- (2026-11-18 handover-readiness fixes)
-- ============================================================================
-- 1) Citizen complaints without a project were still failing live with
--    COMPLAINT_CREATE_FAILED (Postgres 23502): migration-era schema made
--    complaints.project_id NOT NULL, while the product flow (and the
--    backend's CreateComplaintSchema since the 2026-11-18 rebuild) treats
--    project-less complaints as valid. The app-layer fix alone could never
--    work — the column itself must accept NULL. Proven by a direct REST
--    probe during the citizen E2E sweep.
--
-- 2) Historical ai_insights rows could contradict themselves: the model's
--    level was stored in severity/title while risk_level took the column
--    default (MEDIUM). The backend now derives the level from risk_score
--    with fixed bands (0-24 LOW, 25-49 MEDIUM, 50-74 HIGH, 75-100 CRITICAL);
--    align the stored rows to the same bands so old insights read
--    consistently in the UI.
--
-- Run ONLY AFTER 001-037. Idempotent.
-- ============================================================================

ALTER TABLE public.complaints ALTER COLUMN project_id DROP NOT NULL;

WITH banded AS (
  SELECT
    id,
    CASE
      WHEN risk_score >= 75 THEN 'CRITICAL'
      WHEN risk_score >= 50 THEN 'HIGH'
      WHEN risk_score >= 25 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS band
  FROM public.ai_insights
  WHERE risk_score IS NOT NULL
)
UPDATE public.ai_insights i
SET
  risk_level = b.band,
  severity = b.band,
  title = regexp_replace(i.title, '^(LOW|MEDIUM|HIGH|CRITICAL) Risk:', b.band || ' Risk:')
FROM banded b
WHERE i.id = b.id
  AND (
    i.risk_level IS DISTINCT FROM b.band
    OR i.severity IS DISTINCT FROM b.band
  );
