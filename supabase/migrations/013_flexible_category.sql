-- Hapus constraint CHECK pada kategori agar bisa free text
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_category_check;

-- Tambah kolom category_overridden untuk tracking
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category_overridden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS category_ai_suggestion TEXT;
