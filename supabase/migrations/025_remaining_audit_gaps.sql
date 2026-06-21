-- ============================================
-- CLARA: Audit trail tambahan — gap hasil re-audit ISO 9001 / 27001
-- - number_created: penciptaan identitas nomor surat (ISO 9001 §7.5.3, titik kritis)
-- - party_created: pembuatan master data pihak (ISO 9001 §7.5.3)
-- - party_unlinked: penghapusan relasi pihak dari dokumen (ISO 9001 §8.5.2, ISO 27001 A.8.16)
-- ============================================

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

ALTER TABLE public.document_logs ADD CONSTRAINT document_logs_event_type_check
  CHECK (event_type IN (
    'uploaded', 'viewed', 'downloaded', 'deleted',
    'searched', 'classification_changed', 'role_changed',
    'number_created',
    'number_approved', 'number_revision_requested', 'number_rejected',
    'number_voided', 'number_resubmitted', 'number_linked',
    'number_description_edited',
    'party_created', 'party_unlinked'
  ));
