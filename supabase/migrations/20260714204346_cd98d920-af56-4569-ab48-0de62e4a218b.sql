
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;
  SELECT count(*) INTO existing FROM public.user_roles WHERE role = 'admin';
  IF existing > 0 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
    ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
