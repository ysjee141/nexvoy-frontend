-- Allow exact-email user lookup for collaboration features without opening
-- broad profile SELECT access through RLS.

CREATE OR REPLACE FUNCTION public.find_profile_by_email(_email text)
RETURNS TABLE (
  id uuid,
  email text,
  nickname text,
  auth_provider text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.nickname,
    p.auth_provider,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_by_email(text) TO authenticated;
