-- ============================================
-- CLARA: Tambah role Viewer
-- ============================================

-- Update constraint role di profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('viewer', 'auditor', 'contributor', 'admin', 'super_admin'));

-- Update handle_new_user trigger - default role = viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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

-- Update RLS documents - viewer hanya Public & Internal
DROP POLICY IF EXISTS "View documents by classification" ON public.documents;
CREATE POLICY "View documents by classification" ON public.documents
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- Viewer: hanya public & internal
      (
        classification IN ('public', 'internal') AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('viewer', 'auditor', 'contributor', 'admin', 'super_admin'))
      )
      OR
      -- Contributor+: confidential juga
      (
        classification = 'confidential' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('contributor', 'admin', 'super_admin'))
      )
      OR
      -- Admin+: restricted juga
      (
        classification = 'restricted' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      )
    )
  );
