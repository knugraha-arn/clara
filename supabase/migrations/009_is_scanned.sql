-- Tambah kolom is_scanned ke documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_scanned BOOLEAN DEFAULT false;

-- Dokumen lama dibiarkan NULL/false — tidak di-backfill
