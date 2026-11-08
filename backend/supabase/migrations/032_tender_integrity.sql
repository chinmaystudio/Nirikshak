-- ============================================================================
-- 032_tender_integrity.sql — tender integrity guards for the original
-- Nirikshak. Adapted from Nirikshak_craaftverse migration
-- 051_status_and_constraint_alignment_v2.sql (tender parts only).
-- ============================================================================
-- ⚠️  PRE-FLIGHT CENSUS — RUN BEFORE APPLYING THIS FILE ⚠️
--   Sections 2 and 4 will FAIL on live data that violates them (by design:
--   a silent pass would hide dirty data). The applier MUST run these
--   census queries first and clean up whatever they return:
--
--     -- Duplicate tender numbers (blocks uq_tenders_tender_number)
--     SELECT tender_number, count(*)
--     FROM public.tenders
--     GROUP BY tender_number HAVING count(*) > 1;
--
--     -- Tender statuses outside the target vocabulary (blocks the CHECK)
--     SELECT DISTINCT status FROM public.tenders
--     WHERE status NOT IN
--       ('DRAFT','PUBLISHED','CLOSED','UNDER_EVALUATION','AWARDED','CANCELLED');
--
--     -- Bid statuses outside the target vocabulary (blocks the CHECK)
--     SELECT DISTINCT status FROM public.tender_bids
--     WHERE status NOT IN
--       ('DRAFT','SUBMITTED','UNDER_EVALUATION','SELECTED','REJECTED','WITHDRAWN');
--
--     -- Tenders with more than one SELECTED bid (blocks uq_tender_bids_selected)
--     SELECT tender_id, count(*)
--     FROM public.tender_bids
--     WHERE status = 'SELECTED'
--     GROUP BY tender_id HAVING count(*) > 1;
--
--     -- Tenders with more than one ACTIVE contract (blocks uq_contracts_active_tender)
--     SELECT tender_id, count(*)
--     FROM public.contracts
--     WHERE status = 'ACTIVE' AND tender_id IS NOT NULL
--     GROUP BY tender_id HAVING count(*) > 1;
--
-- SAFETY / IDEMPOTENCY
--   * Run ONLY AFTER 030 and 031.
--   * Indexes are IF NOT EXISTS; the trigger is created under a
--     pg_trigger existence guard; CHECK constraints skip themselves when
--     already present but deliberately do NOT swallow check violations.
-- ============================================================================

-- 1. Status transition guard (tenders branch of craaftverse 051's
--    validate_status_transition): an AWARDED tender is irreversible.
CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Tenders: cannot revert from AWARDED
    IF TG_TABLE_NAME = 'tenders' THEN
        IF OLD.status = 'AWARDED' AND NEW.status IN ('DRAFT', 'PUBLISHED', 'UNDER_EVALUATION') THEN
            RAISE EXCEPTION 'Illegal status transition: Awarded tender % cannot revert to %.', OLD.tender_number, NEW.status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_tenders_status') THEN
        CREATE TRIGGER trg_validate_tenders_status
            BEFORE UPDATE OF status ON public.tenders
            FOR EACH ROW EXECUTE FUNCTION public.validate_status_transition();
    END IF;
END $$;

-- 2. Unique consistency indexes
-- One winning bid per tender.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_bids_selected
    ON public.tender_bids (tender_id)
    WHERE (status = 'SELECTED');

-- One active contract per tender.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_active_tender
    ON public.contracts (tender_id)
    WHERE (status = 'ACTIVE' AND tender_id IS NOT NULL);

-- Tender numbers are generated as 'TND-MH-' + epoch suffix with no
-- collision handling in code; make the database enforce uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenders_tender_number
    ON public.tenders (tender_number);

-- 3. Status vocabulary CHECK constraints (the sets the target's code and
--    RPCs actually write/read). A violation aborts this migration — that
--    is the signal to finish the pre-flight census cleanup above.
DO $$
BEGIN
  ALTER TABLE public.tenders
    ADD CONSTRAINT chk_tenders_status_vocabulary
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'UNDER_EVALUATION', 'AWARDED', 'CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.tender_bids
    ADD CONSTRAINT chk_tender_bids_status_vocabulary
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_EVALUATION', 'SELECTED', 'REJECTED', 'WITHDRAWN'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
