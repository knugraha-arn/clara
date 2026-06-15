-- ============================================================
-- CLARA: Party Abbreviation
-- ============================================================

-- Tambah kolom abbreviation di parties
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS abbreviation TEXT;

-- Unique constraint untuk abbreviation
CREATE UNIQUE INDEX IF NOT EXISTS parties_abbreviation_key 
  ON public.parties (UPPER(abbreviation)) 
  WHERE abbreviation IS NOT NULL;

-- Inject abbreviation untuk party yang sudah ada
UPDATE public.parties SET abbreviation = 'DAHA' WHERE id = '3ff3c6be-1e31-4535-8e16-71869250b5fb';
UPDATE public.parties SET abbreviation = 'INT'  WHERE id = 'bf833a04-a480-4b11-8e35-d8089d2938de';
UPDATE public.parties SET abbreviation = 'ADJ'  WHERE id = '0bf2ffdb-af8b-4a04-a4ea-4c30b0ba7b5c';
UPDATE public.parties SET abbreviation = 'AGI'  WHERE id = '4789a2f6-31b6-44bc-a95a-f7e346705839';
UPDATE public.parties SET abbreviation = 'FINT' WHERE id = '3fcf724a-b168-4873-8c33-d730d4a0731e';
UPDATE public.parties SET abbreviation = 'JOSS' WHERE id = '2feec931-b19b-42cc-97c6-7e52f14f09d6';
UPDATE public.parties SET abbreviation = 'MAJU' WHERE id = '8994ea28-35b5-462d-aeac-753734dab0ab';
UPDATE public.parties SET abbreviation = 'MDS'  WHERE id = '0f1b84a6-e3eb-4386-887f-d78f7c8df489';

-- Update nomor surat yang sudah ada sesuai abbreviation baru
UPDATE public.document_numbers dn
SET 
  number = LPAD(dn.sequence::TEXT, 3, '0') || '/' || 
           UPPER(p.abbreviation) || '/' || 
           CASE dn.month
             WHEN 1 THEN 'I' WHEN 2 THEN 'II' WHEN 3 THEN 'III'
             WHEN 4 THEN 'IV' WHEN 5 THEN 'V' WHEN 6 THEN 'VI'
             WHEN 7 THEN 'VII' WHEN 8 THEN 'VIII' WHEN 9 THEN 'IX'
             WHEN 10 THEN 'X' WHEN 11 THEN 'XI' WHEN 12 THEN 'XII'
           END || '/' || dn.year,
  party_name = UPPER(p.abbreviation),
  updated_at = NOW()
FROM public.parties p
WHERE dn.party_id = p.id
  AND p.abbreviation IS NOT NULL
  AND dn.status NOT IN ('void', 'rejected');
