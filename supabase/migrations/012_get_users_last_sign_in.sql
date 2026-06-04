-- Function untuk ambil last_sign_in_at dari auth.users
-- Dipanggil via service_role (adminSupabase)
CREATE OR REPLACE FUNCTION get_users_last_sign_in()
RETURNS TABLE (id UUID, last_sign_in_at TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT id, last_sign_in_at FROM auth.users;
$$;

GRANT EXECUTE ON FUNCTION get_users_last_sign_in() TO service_role;
