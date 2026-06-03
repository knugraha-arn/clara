-- ============================================
-- CLARA: Shared document access
-- Semua user @arranetwork.com bisa lihat semua dokumen
-- Run di Supabase SQL Editor
-- ============================================

-- Drop policy lama yang restrict per user
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view own embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Users can view own search history" ON public.search_history;

-- Documents: semua authenticated user bisa READ
CREATE POLICY "Authenticated users can view all documents" ON public.documents
  FOR SELECT USING (auth.role() = 'authenticated');

-- Documents: hanya uploader yang bisa UPDATE & DELETE
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Embeddings: semua authenticated user bisa READ
CREATE POLICY "Authenticated users can view all embeddings" ON public.document_embeddings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Search history: tetap private per user
CREATE POLICY "Users can view own search history" ON public.search_history
  FOR SELECT USING (auth.uid() = user_id);

-- Storage: semua authenticated user bisa download
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
CREATE POLICY "Authenticated users can view all documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Fungsi semantic search tanpa filter user_id
CREATE OR REPLACE FUNCTION search_documents_semantic_all(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  document_id UUID,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE
    d.status = 'ready'
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;
