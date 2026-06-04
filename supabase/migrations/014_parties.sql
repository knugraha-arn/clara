-- ============================================
-- CLARA: Party Management
-- ============================================

-- Tabel master parties
CREATE TABLE IF NOT EXISTS public.parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT GENERATED ALWAYS AS (LOWER(name)) STORED,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name_lower)
);

CREATE INDEX IF NOT EXISTS parties_name_lower_idx ON public.parties(name_lower);
CREATE INDEX IF NOT EXISTS parties_name_trgm_idx ON public.parties USING gin(name_lower gin_trgm_ops);

-- Tabel relasi dokumen-party (many-to-many)
CREATE TABLE IF NOT EXISTS public.document_parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, party_id)
);

CREATE INDEX IF NOT EXISTS document_parties_document_idx ON public.document_parties(document_id);
CREATE INDEX IF NOT EXISTS document_parties_party_idx ON public.document_parties(party_id);

-- RLS
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_parties ENABLE ROW LEVEL SECURITY;

-- Parties: semua authenticated bisa read, authenticated bisa insert
CREATE POLICY "Authenticated users can view parties" ON public.parties
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert parties" ON public.parties
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Document parties: ikut akses dokumen
CREATE POLICY "Authenticated users can view document parties" ON public.document_parties
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert document parties" ON public.document_parties
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete document parties" ON public.document_parties
  FOR DELETE USING (auth.role() = 'authenticated');

-- Enable pg_trgm untuk fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function autocomplete parties
CREATE OR REPLACE FUNCTION search_parties(query TEXT, limit_count INT DEFAULT 10)
RETURNS TABLE (id UUID, name TEXT, doc_count BIGINT)
LANGUAGE SQL STABLE
AS $$
  SELECT 
    p.id,
    p.name,
    COUNT(dp.document_id) as doc_count
  FROM parties p
  LEFT JOIN document_parties dp ON dp.party_id = p.id
  WHERE p.name_lower LIKE '%' || LOWER(query) || '%'
     OR p.name_lower % LOWER(query)
  GROUP BY p.id, p.name
  ORDER BY 
    CASE WHEN p.name_lower LIKE LOWER(query) || '%' THEN 0 ELSE 1 END,
    doc_count DESC,
    p.name ASC
  LIMIT limit_count;
$$;
