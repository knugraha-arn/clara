-- ============================================
-- Update embedding dimension: 768 → 1536
-- (Gemini → OpenAI text-embedding-3-small)
-- Run di Supabase SQL Editor
-- ============================================

-- Drop index dulu
DROP INDEX IF EXISTS document_embeddings_embedding_idx;

-- Hapus kolom lama dan buat baru dengan dimension 1536
ALTER TABLE public.document_embeddings 
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE public.document_embeddings 
  ADD COLUMN embedding vector(1536);

-- Buat index baru
CREATE INDEX document_embeddings_embedding_idx
  ON public.document_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Update fungsi semantic search dengan dimension baru
CREATE OR REPLACE FUNCTION search_documents_semantic(
  query_embedding vector(1536),
  user_id_filter UUID,
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
    d.user_id = user_id_filter
    AND d.status = 'ready'
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;
