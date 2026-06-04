-- ============================================
-- CLARA: Master Document Register View
-- ============================================

CREATE OR REPLACE VIEW master_document_register AS
SELECT
  ROW_NUMBER() OVER (ORDER BY d.created_at DESC) as no_urut,
  d.id,
  d.title as judul_dokumen,
  d.file_name as nama_file,
  CASE d.category
    WHEN 'surat_masuk'  THEN 'Surat Masuk'
    WHEN 'surat_keluar' THEN 'Surat Keluar'
    WHEN 'kontrak'      THEN 'Kontrak'
    WHEN 'memo'         THEN 'Memo'
    WHEN 'laporan'      THEN 'Laporan'
    WHEN 'kebijakan'    THEN 'Kebijakan'
    WHEN 'undangan'     THEN 'Undangan'
    WHEN 'pengumuman'   THEN 'Pengumuman'
    ELSE 'Lainnya'
  END as kategori,
  CASE d.classification
    WHEN 'public'       THEN 'Public'
    WHEN 'internal'     THEN 'Internal'
    WHEN 'confidential' THEN 'Confidential'
    WHEN 'restricted'   THEN 'Restricted'
  END as klasifikasi,
  p.full_name as diupload_oleh,
  p.email as email_uploader,
  d.created_at::DATE as tanggal_upload,
  d.page_count as jumlah_halaman,
  ROUND(d.file_size / 1024.0, 0) as ukuran_kb,
  d.retention_date as retensi_sampai,
  CASE 
    WHEN d.retention_date < CURRENT_DATE THEN 'Expired'
    WHEN d.retention_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
    ELSE 'Active'
  END as status_retensi,
  d.tags,
  d.summary as ringkasan,
  d.status
FROM documents d
LEFT JOIN profiles p ON p.id = d.user_id
WHERE d.status = 'ready'
ORDER BY d.created_at DESC;

-- Grant akses view ke authenticated users
GRANT SELECT ON master_document_register TO authenticated;
