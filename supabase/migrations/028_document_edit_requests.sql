-- ============================================
-- CLARA: Request perubahan detail dokumen + approval
-- ISO 9001 §7.5.3 — perubahan documented information harus terkendali & terlacak
-- ISO 27001 A.8.16 — tindakan privileged (approval) tercatat
-- ============================================

CREATE TABLE IF NOT EXISTS public.document_edit_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,

  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  requested_by_role TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),

  -- Snapshot perubahan: { "title": {"old": "...", "new": "..."}, "category": {...}, ... }
  changes JSONB NOT NULL,
  reason TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,

  -- true jika auto-approved (super_admin mengajukan untuk dirinya sendiri)
  auto_approved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_edit_requests_document_idx ON public.document_edit_requests(document_id);
CREATE INDEX IF NOT EXISTS document_edit_requests_status_idx ON public.document_edit_requests(status);
CREATE INDEX IF NOT EXISTS document_edit_requests_requested_by_idx ON public.document_edit_requests(requested_by);

ALTER TABLE public.document_edit_requests ENABLE ROW LEVEL SECURITY;

-- Semua authenticated bisa lihat (read transparan, sama seperti document_logs)
CREATE POLICY "Authenticated users can view edit requests" ON public.document_edit_requests
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert/update HANYA lewat service role (endpoint API validasi manual) — konsisten
-- dengan pola document_logs immutable; tidak ada UPDATE/DELETE policy untuk client biasa.

-- Audit event types baru
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
    'classification_changed', 'role_changed',
    'user_suspended', 'user_unsuspended',
    'number_created',
    'number_approved', 'number_revision_requested', 'number_rejected',
    'number_voided', 'number_resubmitted', 'number_linked',
    'number_description_edited',
    'party_created', 'party_unlinked',
    'edit_requested', 'edit_approved', 'edit_rejected', 'edit_auto_approved'
  ));
