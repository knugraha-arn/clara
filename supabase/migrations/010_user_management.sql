-- ============================================
-- CLARA: User Management
-- Tambah kolom is_suspended ke profiles
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Update last_active via trigger saat user login
-- (Supabase handles this via auth.users.last_sign_in_at)
