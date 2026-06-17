-- Hotfix: update RPC search_documents_semantic_all ke SECURITY INVOKER
-- Jalankan ini di SQL Editor Supabase

DROP FUNCTION IF EXISTS search_documents_semantic_all(vector, double precision, integer);

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
SECURITY INVOKER
STABLE
AS $$
  SELECT
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  INNER JOIN documents d ON d.id = de.document_id
  WHERE
    d.status = 'ready'
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION search_documents_semantic_all(vector, float, int) TO authenticated;
