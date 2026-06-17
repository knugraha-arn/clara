-- ============================================================
-- CLARA: Tambah kategori Invoice, Purchase Order, Berita Acara
-- Default klasifikasi: Restricted (dihandle di AI prompt)
-- ============================================================

INSERT INTO public.document_categories (id, label, sort_order, is_active)
VALUES
  ('invoice',      'Invoice',        12, true),
  ('po',           'Purchase Order', 13, true),
  ('berita_acara', 'Berita Acara',   14, true)
ON CONFLICT (id) DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active;
