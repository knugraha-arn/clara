-- ============================================================
-- CLARA: Document Categories Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_categories (
  id TEXT PRIMARY KEY,          -- slug: surat_masuk, kontrak, nda, dll
  label TEXT NOT NULL,          -- display name: Surat Masuk, Kontrak, NDA
  description TEXT,             -- keterangan opsional
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categories" ON public.document_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super admin can manage categories" ON public.document_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Seed data
INSERT INTO public.document_categories (id, label, sort_order) VALUES
  ('surat_masuk',  'Surat Masuk',  1),
  ('surat_keluar', 'Surat Keluar', 2),
  ('kontrak',      'Kontrak',      3),
  ('nda',          'NDA',          4),
  ('memo',         'Memo',         5),
  ('laporan',      'Laporan',      6),
  ('kebijakan',    'Kebijakan',    7),
  ('undangan',     'Undangan',     8),
  ('pengumuman',   'Pengumuman',   9),
  ('lainnya',      'Lainnya',      99)
ON CONFLICT (id) DO NOTHING;
