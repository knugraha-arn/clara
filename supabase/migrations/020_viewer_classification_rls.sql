-- ============================================================
-- CLARA: Viewer classification access control
-- User baru default role = viewer
-- Viewer hanya bisa lihat dokumen Public & Internal
-- ============================================================

-- 1. Pastikan default role = viewer sudah terset
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'viewer';

-- 2. Pastikan trigger handle_new_user set role = viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pastikan RLS documents aktif
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4. Update policy SELECT dokumen berdasarkan role
DROP POLICY IF EXISTS "View documents by classification" ON public.documents;
CREATE POLICY "View documents by classification" ON public.documents
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- Viewer & Auditor: hanya public & internal
      (
        classification IN ('public', 'internal') AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('viewer', 'auditor', 'contributor', 'admin', 'super_admin')
          AND (is_suspended IS NULL OR is_suspended = false)
        )
      )
      OR
      -- Contributor+: confidential juga
      (
        classification = 'confidential' AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('contributor', 'admin', 'super_admin')
          AND (is_suspended IS NULL OR is_suspended = false)
        )
      )
      OR
      -- Admin+: restricted juga
      (
        classification = 'restricted' AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
          AND (is_suspended IS NULL OR is_suspended = false)
        )
      )
    )
  );

-- 5. Update RPC semantic search agar filter classification sesuai role pemanggil
--    Fungsi ini dipanggil via createClient() (anon key), bukan adminClient
--    Dengan SECURITY INVOKER, RLS berlaku otomatis untuk query ke documents
DROP FUNCTION IF EXISTS search_documents_semantic_all(vector, float, int);

CREATE OR REPLACE FUNCTION search_documents_semantic_all(
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  document_id UUID,
  chunk_text TEXT,
  similarity float
)
LANGUAGE SQL
SECURITY INVOKER  -- pakai hak akses pemanggil, bukan definer → RLS aktif
STABLE
AS $$
  SELECT
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  INNER JOIN documents d ON d.id = de.document_id  -- JOIN ke documents → RLS documents berlaku
  WHERE
    d.status = 'ready'
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute ke authenticated users
GRANT EXECUTE ON FUNCTION search_documents_semantic_all(vector, float, int) TO authenticated;

-- 6. Pastikan user suspended tidak bisa akses sama sekali
DROP POLICY IF EXISTS "Suspended users cannot access" ON public.documents;
-- (sudah di-handle di policy di atas via is_suspended check)
