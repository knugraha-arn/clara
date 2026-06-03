-- Rename role viewer → auditor
-- Update default
ALTER TABLE public.profiles 
  ALTER COLUMN role SET DEFAULT 'auditor';

-- Update existing viewer records
UPDATE public.profiles SET role = 'auditor' WHERE role = 'viewer';

-- Update trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    'auditor'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies yang pakai role viewer
DROP POLICY IF EXISTS "Contributors can insert documents" ON public.documents;
CREATE POLICY "Contributors can insert documents" ON public.documents
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Contributors can delete own documents" ON public.documents;
CREATE POLICY "Contributors can delete own documents" ON public.documents
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('contributor', 'admin', 'super_admin')
    )
  );
