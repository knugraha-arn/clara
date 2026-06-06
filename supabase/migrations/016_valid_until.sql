-- ============================================
-- CLARA: Document Valid Until (Masa Berlaku)
-- Terpisah dari retention_date
-- ============================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS valid_until DATE;

CREATE INDEX IF NOT EXISTS documents_valid_until_idx ON public.documents(valid_until);
