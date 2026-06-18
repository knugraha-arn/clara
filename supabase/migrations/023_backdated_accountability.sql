-- ============================================================
-- CLARA: Backdated accountability fields
-- Untuk audit trail dan compliance ISO
-- ============================================================

ALTER TABLE public.document_numbers
  ADD COLUMN IF NOT EXISTS backdated_reason TEXT,
  ADD COLUMN IF NOT EXISTS backdated_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS approval_consent BOOLEAN DEFAULT false;
