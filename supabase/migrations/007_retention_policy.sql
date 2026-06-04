-- ============================================
-- CLARA: Retention Policy
-- ============================================

-- Tambah kolom retention ke documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS retention_date DATE,
  ADD COLUMN IF NOT EXISTS retention_policy TEXT DEFAULT 'standard'
    CHECK (retention_policy IN ('standard', 'extended', 'permanent', 'custom')),
  ADD COLUMN IF NOT EXISTS retention_extended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_extended_by UUID REFERENCES auth.users(id);

-- Default retention per kategori (dalam tahun):
-- surat_masuk/keluar: 5 tahun
-- kontrak: 10 tahun
-- memo: 2 tahun
-- laporan: 5 tahun
-- kebijakan: 7 tahun
-- lainnya: 5 tahun

-- Set retention date otomatis saat dokumen diinsert
CREATE OR REPLACE FUNCTION set_default_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.retention_date IS NULL THEN
    NEW.retention_date := CASE NEW.category
      WHEN 'kontrak'   THEN (CURRENT_DATE + INTERVAL '10 years')::DATE
      WHEN 'kebijakan' THEN (CURRENT_DATE + INTERVAL '7 years')::DATE
      WHEN 'memo'      THEN (CURRENT_DATE + INTERVAL '2 years')::DATE
      WHEN 'laporan'   THEN (CURRENT_DATE + INTERVAL '5 years')::DATE
      ELSE                  (CURRENT_DATE + INTERVAL '5 years')::DATE
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_retention_on_insert ON public.documents;
CREATE TRIGGER set_retention_on_insert
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION set_default_retention();

-- Update dokumen yang sudah ada (set retention dari created_at)
UPDATE public.documents SET retention_date = CASE category
  WHEN 'kontrak'   THEN (created_at + INTERVAL '10 years')::DATE
  WHEN 'kebijakan' THEN (created_at + INTERVAL '7 years')::DATE
  WHEN 'memo'      THEN (created_at + INTERVAL '2 years')::DATE
  WHEN 'laporan'   THEN (created_at + INTERVAL '5 years')::DATE
  ELSE                  (created_at + INTERVAL '5 years')::DATE
END
WHERE retention_date IS NULL;

-- View untuk dokumen yang akan expired (H-30)
CREATE OR REPLACE VIEW documents_expiring_soon AS
SELECT 
  d.*,
  p.full_name as uploader_name,
  p.email as uploader_email,
  (d.retention_date - CURRENT_DATE) as days_until_expiry
FROM documents d
LEFT JOIN profiles p ON p.id = d.user_id
WHERE 
  d.retention_date IS NOT NULL
  AND d.retention_date <= CURRENT_DATE + INTERVAL '30 days'
  AND d.status = 'ready'
ORDER BY d.retention_date ASC;
