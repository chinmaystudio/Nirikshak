-- 032_z_schema_drift_baseline.sql
-- Objects that exist in the production database (created out-of-band through
-- the SQL editor) but were never captured in a migration, so a fresh database
-- could not be rebuilt from this folder. Every statement is idempotent
-- (IF NOT EXISTS / CREATE OR REPLACE): on production this file is a no-op.
-- Discovered by replaying 001..039 on an empty database in CI.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS approved_cost_inr_crore numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_visibility boolean DEFAULT true;
