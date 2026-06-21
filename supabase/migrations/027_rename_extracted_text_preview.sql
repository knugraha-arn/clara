-- ============================================
-- CLARA: Rename extracted_text_page1 -> extracted_text_preview
-- Nama lama menyiratkan batas per-halaman yang presisi, padahal
-- sebenarnya cuma potongan awal teks gabungan berbasis jumlah karakter.
-- Diperluas dari ~3000 karakter (~1 halaman) jadi ~7000 karakter (~2 halaman).
-- ============================================

ALTER TABLE public.documents RENAME COLUMN extracted_text_page1 TO extracted_text_preview;
