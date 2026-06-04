-- ============================================
-- CLARA: Document Numbering System
-- ============================================

CREATE TABLE IF NOT EXISTS public.document_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Nomor surat
  number TEXT UNIQUE NOT NULL,          -- e.g. 001/KARVELO/VI/2026
  sequence INT NOT NULL,                -- urut per tahun
  year INT NOT NULL,
  month INT NOT NULL,                   -- bulan dari tanggal surat
  date DATE NOT NULL,                   -- tanggal surat

  -- Detail
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  party_name TEXT NOT NULL,             -- snapshot nama party
  category TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  description TEXT NOT NULL,            -- perihal/uraian

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'issued', 'linked', 'rejected', 'void')),
  is_backdated BOOLEAN DEFAULT false,

  -- Linking ke dokumen
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

  -- Audit fields
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,

  -- Approval
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_action TEXT CHECK (review_action IN ('approved', 'revision', 'rejected')),
  review_note TEXT,                     -- catatan dari admin

  -- Void
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by_name TEXT,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS document_numbers_year_idx ON public.document_numbers(year);
CREATE INDEX IF NOT EXISTS document_numbers_status_idx ON public.document_numbers(status);
CREATE INDEX IF NOT EXISTS document_numbers_party_idx ON public.document_numbers(party_id);
CREATE INDEX IF NOT EXISTS document_numbers_document_idx ON public.document_numbers(document_id);

-- RLS
ALTER TABLE public.document_numbers ENABLE ROW LEVEL SECURITY;

-- Semua authenticated bisa lihat
CREATE POLICY "Authenticated can view document numbers" ON public.document_numbers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Contributor+ bisa insert
CREATE POLICY "Contributors can insert document numbers" ON public.document_numbers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );

-- Update: creator bisa update draft/pending miliknya, admin bisa update semua
CREATE POLICY "Users can update own draft numbers" ON public.document_numbers
  FOR UPDATE USING (
    (created_by = auth.uid() AND status IN ('draft'))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
