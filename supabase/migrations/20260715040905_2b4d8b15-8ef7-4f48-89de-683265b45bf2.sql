CREATE OR REPLACE FUNCTION public.expire_reservations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  WITH upd AS (
    UPDATE public.tickets
    SET status='available', buyer_name=NULL, buyer_phone=NULL, buyer_state=NULL, reserved_at=NULL, confirmed_at=NULL
    WHERE status='reserved' AND reserved_at < now() - interval '30 minutes'
    RETURNING number
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$function$;