
CREATE OR REPLACE FUNCTION public.find_or_create_profile_by_email(_email TEXT)
RETURNS TABLE(id UUID, email TEXT, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
  v_meta JSONB;
BEGIN
  SELECT u.id, u.email, u.raw_user_meta_data
    INTO v_id, v_email, v_meta
    FROM auth.users u
    WHERE lower(u.email) = lower(_email)
    LIMIT 1;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.profiles(id, email, full_name)
    VALUES(v_id, v_email, COALESCE(v_meta->>'full_name', v_email))
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN QUERY SELECT p.id, p.email, p.full_name FROM public.profiles p WHERE p.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_profile_by_email(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.find_or_create_profile_by_email(TEXT) TO authenticated;
