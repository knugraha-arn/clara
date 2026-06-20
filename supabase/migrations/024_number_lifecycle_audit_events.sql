-- ============================================
-- CLARA: Audit trail untuk lifecycle nomor surat
-- ISO 9001 §7.5.3, §8.5.2 — traceability dokumen terkendali
-- ISO 27001 A.8.15, A.8.16 — logging & monitoring tindakan privileged
-- ============================================

-- Drop CHECK constraint lama pada kolom event_type secara dinamis
-- (tidak hardcode nama constraint, supaya migration tetap jalan
-- walau nama auto-generated berbeda dari ekspektasi)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'document_logs'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%event_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_logs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Buat ulang dengan event type baru untuk lifecycle nomor surat
ALTER TABLE public.document_logs ADD CONSTRAINT document_logs_event_type_check
  CHECK (event_type IN (
    'uploaded', 'viewed', 'downloaded', 'deleted',
    'searched', 'classification_changed', 'role_changed',
    'number_approved', 'number_revision_requested', 'number_rejected',
    'number_voided', 'number_resubmitted', 'number_linked',
    'number_description_edited'
  ));

