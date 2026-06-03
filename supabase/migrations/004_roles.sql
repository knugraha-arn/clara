-- ============================================
-- CLARA: Role-based access
-- viewer: view & search only
-- contributor: view, search, upload
-- super_admin: semua termasuk hapus
-- ============================================

-- Update enum role di profiles (sudah ada kolom role)
-- Default role untuk user baru = viewer
ALTER TABLE public.profiles 
  ALTER COLUMN role SET DEFAULT 'viewer';

-- Update trigger untuk set default role viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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

-- Documents INSERT: hanya contributor & super_admin
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Contributors can insert documents" ON public.documents
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );

-- Documents DELETE: hanya super_admin atau uploader yang contributor+
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Contributors can delete own documents" ON public.documents
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );

-- Storage INSERT: hanya contributor+
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Contributors can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );

-- Storage DELETE: hanya contributor+
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Contributors can delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );

-- View profiles: user bisa lihat profile sendiri + profile orang lain (untuk tau siapa uploader)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Update profile: hanya diri sendiri
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
