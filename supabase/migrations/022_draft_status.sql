-- ============================================================
-- CLARA: Tambah status 'draft' untuk dokumen yang belum dikonfirmasi
-- Dokumen draft tidak muncul di dashboard
-- ============================================================

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'processing', 'ready', 'error'));
