-- ============================================
-- CLARA: Klasifikasi + Audit Trail
-- ============================================

-- 1. Tambah kolom klasifikasi ke documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  ADD COLUMN IF NOT EXISTS classification_ai_suggestion TEXT,
  ADD COLUMN IF NOT EXISTS classification_confidence FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS classification_overridden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification_override_reason TEXT;

-- 2. Tabel audit trail (immutable - tidak bisa update/delete)
CREATE TABLE IF NOT EXISTS public.document_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  document_title TEXT, -- simpan title supaya log tetap ada meski dokumen dihapus
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'uploaded', 'viewed', 'downloaded', 'deleted',
    'searched', 'classification_changed', 'role_changed'
  )),
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS document_logs_document_id_idx ON public.document_logs(document_id);
CREATE INDEX IF NOT EXISTS document_logs_user_id_idx ON public.document_logs(user_id);
CREATE INDEX IF NOT EXISTS document_logs_event_type_idx ON public.document_logs(event_type);
CREATE INDEX IF NOT EXISTS document_logs_created_at_idx ON public.document_logs(created_at DESC);

-- RLS audit trail
ALTER TABLE public.document_logs ENABLE ROW LEVEL SECURITY;

-- Semua authenticated user bisa INSERT log
CREATE POLICY "Authenticated users can insert logs" ON public.document_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Hanya super_admin & auditor yang bisa READ semua log
CREATE POLICY "Admins and auditors can view all logs" ON public.document_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'auditor')
    )
  );

-- TIDAK ADA policy UPDATE & DELETE = immutable

-- 3. RLS dokumen berdasarkan klasifikasi
-- Restricted: hanya admin & super_admin
-- Confidential: contributor ke atas
-- Internal & Public: semua authenticated

DROP POLICY IF EXISTS "Authenticated users can view all documents" ON public.documents;
CREATE POLICY "View documents by classification" ON public.documents
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      classification IN ('public', 'internal')
      OR (
        classification = 'confidential' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('contributor', 'admin', 'super_admin'))
      )
      OR (
        classification = 'restricted' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      )
    )
  );
