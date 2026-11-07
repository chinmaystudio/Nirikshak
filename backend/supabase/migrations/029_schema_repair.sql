-- ============================================================================
-- 029_schema_repair.sql — corrective repair for the 001–028 migration set
-- ============================================================================
-- WHY THIS FILE EXISTS
--   Migrations 001–028 define most core tables TWICE: once inside
--   001_initial_schema.sql and again in their per-domain file (002–016).
--   Both definitions use CREATE TABLE IF NOT EXISTS, so whichever file ran
--   first silently wins and the second definition is ignored (see
--   original-code-audit.md §6.3). A database provisioned from these files
--   can therefore have either lineage's schema, with no error recorded.
--
--   The concrete divergences this file repairs:
--     * profiles.full_name — 001: TEXT NOT NULL DEFAULT 'User'
--                            002: TEXT NOT NULL (no default)
--       -> inserts that omit full_name fail on the 002 lineage.
--     * profiles.role      — 001: user_role NOT NULL DEFAULT 'citizen'
--                            002: column does not exist at all
--       -> any code/function selecting profiles.role breaks on the
--          002 lineage.
--     * organization_members.status — defaults to 'active' in 001/003, but
--       migration 024 and later hardening files mix 'active' / 'ACTIVE'
--       casings, so rows can exist in either casing while some policies
--       compare case-sensitively.
--
-- SAFETY / IDEMPOTENCY
--   * Run this file ONLY AFTER migrations 001–028 have been applied.
--   * Every statement is guarded: it is a no-op when the database already
--     matches the intended (001-lineage) shape. It can be re-run safely.
--   * It changes NO other data: the only UPDATE touches rows of
--     organization_members whose status is already 'active' in some other
--     casing, normalising the casing only.
--
-- DELIBERATELY NOT AUTO-REPAIRED
--   * projects.normalized_status — 001 types it as the project_status
--     ENUM, 004 types it as TEXT DEFAULT 'UNKNOWN'. Converting a live
--     column between enum and text requires knowing which lineage won
--     AND which values are present, so it is NOT converted here.
--     Manual check (run by the operator, then convert by hand if the
--     TEXT lineage won and the enum lineage is desired — or leave as
--     TEXT, which the application tolerates):
--
--       SELECT data_type, udt_name
--       FROM information_schema.columns
--       WHERE table_schema = 'public'
--         AND table_name = 'projects'
--         AND column_name = 'normalized_status';
--       -- data_type 'USER-DEFINED' + udt_name 'project_status' = enum (001)
--       -- data_type 'text'                                     = text (004)
-- ============================================================================

-- 1) profiles.full_name: restore the 001-lineage default ('User') so
--    inserts that omit full_name succeed on either lineage.
--    Guarded: no-op if the column does not exist (nothing safe to repair).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN full_name SET DEFAULT 'User';
  END IF;
END $$;

-- 2) profiles.role: add the column ONLY if it is missing (002 lineage).
--    The column is added as plain `text` with default 'citizen' on purpose:
--    the user_role enum exists only in the 001 lineage, so referencing it
--    here would fail on exactly the databases this repair targets. If the
--    column already exists (001 lineage, user_role enum), this is a no-op
--    and the enum type is left untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'citizen';
  END IF;
END $$;

-- 3) organization_members.status: normalise casing to lower-case 'active'.
--    Only rows that are 'active' in some other casing are touched; every
--    other status value is left exactly as-is. Re-running matches no rows.
UPDATE public.organization_members
SET status = 'active'
WHERE lower(status) = 'active'
  AND status <> 'active';
