-- ============================================================================
-- 036_ai_insights_honesty.sql — store the full AI analysis, stop fabricating
-- confidence (2026-11-18 rebuild)
-- ============================================================================
-- * risk_score + details (schedule/finance/environment breakdown) columns:
--   the analyze route computed them but had nowhere to persist them, so the
--   UI could only ever show the summary.
-- * confidence: the column default 0.85 and the route's hard-coded 0.92 were
--   invented numbers presented as model certainty — the provider returns no
--   confidence. Drop the default and clear existing fabricated values.
-- * Existing rows: every stored confidence came from those two fabricated
--   sources (route constant or column default), never from a model, so
--   nulling them is a correction, not data loss.
--
-- Run ONLY AFTER 001–035. Idempotent.
-- ============================================================================

ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC,
  ADD COLUMN IF NOT EXISTS details JSONB;

ALTER TABLE public.ai_insights
  ALTER COLUMN confidence DROP DEFAULT;

UPDATE public.ai_insights
SET confidence = NULL
WHERE confidence IS NOT NULL;
