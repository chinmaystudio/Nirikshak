-- ============================================================================
-- 031_tender_documents_rls_storage.sql — RLS + storage for the tender
-- document tables created in 030, plus tender list indexes.
-- Adapted from Nirikshak_craaftverse migrations 042 (document-table
-- policies only), 044 (tender-documents bucket) and 045 (composite
-- indexes), re-based onto the TARGET repo's helper functions
-- (get_user_organization_id / is_government_user — craaftverse's
-- get_current_user_organization_id does not exist here).
-- ============================================================================
-- SAFETY / IDEMPOTENCY
--   * Run ONLY AFTER 030 (the document tables must exist).
--   * Policies are DROP IF EXISTS + CREATE; the bucket insert is
--     ON CONFLICT DO NOTHING; indexes are IF NOT EXISTS. Re-runnable.
-- ============================================================================

-- 1. Enable RLS on the document tables
ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_documents ENABLE ROW LEVEL SECURITY;

-- 2. Tender & bid document policies (adapted from craaftverse 042)
-- Public tender documents readable by authenticated users;
-- government users can read every tender document.
DROP POLICY IF EXISTS "Public tender documents readable by all authenticated" ON public.tender_documents;
CREATE POLICY "Public tender documents readable by all authenticated"
  ON public.tender_documents FOR SELECT
  TO authenticated
  USING (visibility = 'PUBLIC' OR public.is_government_user());

-- Bid documents: strictly the uploading contractor, the owning
-- contractor organization, or a government evaluator.
DROP POLICY IF EXISTS "Contractor can view own bid documents" ON public.bid_documents;
CREATE POLICY "Contractor can view own bid documents"
  ON public.bid_documents FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tender_bids b
      WHERE b.id = bid_documents.bid_id
        AND b.contractor_organization_id = public.get_user_organization_id()
    ) OR
    public.is_government_user()
  );

DROP POLICY IF EXISTS "Contractor can upload own bid documents" ON public.bid_documents;
CREATE POLICY "Contractor can upload own bid documents"
  ON public.bid_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.tender_bids b
      WHERE b.id = bid_documents.bid_id
        AND b.contractor_organization_id = public.get_user_organization_id()
    )
  );

-- No UPDATE/DELETE policies on either document table: documents are
-- immutable through PostgREST by design (same as craaftverse 042).

-- 3. Storage: tender-documents bucket (adapted from craaftverse 044)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tender-documents', 'tender-documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage objects cannot carry per-document visibility, so reads at the
-- storage layer are limited to authenticated users (the table-level
-- policies above remain the fine-grained gate for document metadata),
-- while uploads are government-only, mirroring who publishes tenders.
DROP POLICY IF EXISTS "Tender documents restricted view" ON storage.objects;
CREATE POLICY "Tender documents restricted view" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tender-documents' AND
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Government tender document upload" ON storage.objects;
CREATE POLICY "Government tender document upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tender-documents' AND
    public.is_government_user()
  );

-- 4. Composite list indexes (from craaftverse 045, target table shapes)
CREATE INDEX IF NOT EXISTS idx_tenders_proj_status
  ON public.tenders(project_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenders_due_date
  ON public.tenders(bid_due_date)
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tender_bids_tender_status
  ON public.tender_bids(tender_id, status);

CREATE INDEX IF NOT EXISTS idx_tender_bids_contractor
  ON public.tender_bids(contractor_organization_id, tender_id);
