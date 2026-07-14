
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS buyer_state text;

CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH upd AS (
    UPDATE public.tickets
    SET status='available', buyer_name=NULL, buyer_phone=NULL, buyer_state=NULL, reserved_at=NULL, confirmed_at=NULL
    WHERE status='reserved' AND reserved_at < now() - interval '20 minutes'
    RETURNING number
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END; $$;

GRANT EXECUTE ON FUNCTION public.expire_reservations() TO anon, authenticated;

DROP FUNCTION IF EXISTS public.reserve_tickets(text, text, integer[]);

CREATE OR REPLACE FUNCTION public.reserve_tickets(_name text, _phone text, _state text, _numbers integer[])
RETURNS TABLE(reserved integer[], unavailable integer[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved_nums integer[];
  requested_count integer;
BEGIN
  IF _name IS NULL OR length(trim(_name)) < 2 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
  IF _phone IS NULL OR length(trim(_phone)) < 8 THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
  IF _state IS NULL OR length(trim(_state)) < 2 THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  requested_count := array_length(_numbers, 1);
  IF requested_count IS NULL OR requested_count = 0 THEN RAISE EXCEPTION 'Debe seleccionar al menos un boleto'; END IF;
  IF requested_count > 200 THEN RAISE EXCEPTION 'Máximo 200 boletos por operación'; END IF;

  PERFORM public.expire_reservations();

  WITH upd AS (
    UPDATE public.tickets
    SET status='reserved', buyer_name=trim(_name), buyer_phone=trim(_phone), buyer_state=trim(_state), reserved_at=now()
    WHERE number = ANY(_numbers) AND status='available'
    RETURNING number
  ) SELECT array_agg(number ORDER BY number) INTO reserved_nums FROM upd;

  reserved := COALESCE(reserved_nums, ARRAY[]::integer[]);
  unavailable := ARRAY(SELECT unnest(_numbers) EXCEPT SELECT unnest(reserved));
  RETURN NEXT;
END; $$;
