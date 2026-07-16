
-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE from PUBLIC/anon,
-- grant only to roles that need to invoke them from the app.

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.release_tickets(integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_tickets(integer[]) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_tickets(integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tickets(integer[]) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Anon buyers must be able to reserve tickets from the public page
REVOKE ALL ON FUNCTION public.reserve_tickets(text, text, text, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_tickets(text, text, text, integer[]) TO anon, authenticated;

-- Internal-only helpers: no direct client execution
REVOKE ALL ON FUNCTION public.expire_reservations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_tickets_status() FROM PUBLIC, anon, authenticated;
