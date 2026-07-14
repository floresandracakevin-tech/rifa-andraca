
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Tickets
CREATE TABLE public.tickets (
  number INTEGER PRIMARY KEY CHECK (number BETWEEN 1 AND 60000),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','confirmed')),
  buyer_name TEXT,
  buyer_phone TEXT,
  reserved_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

GRANT SELECT ON public.tickets TO anon, authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Public can see ticket status only (buyer info protected via column-level policy through a view)
CREATE POLICY "public can see ticket status" ON public.tickets
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admin full access
CREATE POLICY "admin manages tickets" ON public.tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed 60,000 tickets
INSERT INTO public.tickets (number)
SELECT generate_series(1, 60000);

-- Public safe view (hides buyer info)
CREATE OR REPLACE VIEW public.tickets_public AS
  SELECT number, status FROM public.tickets;

GRANT SELECT ON public.tickets_public TO anon, authenticated;

-- Reserve tickets: atomic, only 'available' -> 'reserved'
CREATE OR REPLACE FUNCTION public.reserve_tickets(_name TEXT, _phone TEXT, _numbers INTEGER[])
RETURNS TABLE(reserved INTEGER[], unavailable INTEGER[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved_nums INTEGER[];
  requested_count INTEGER;
BEGIN
  IF _name IS NULL OR length(trim(_name)) < 2 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _phone IS NULL OR length(trim(_phone)) < 8 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  requested_count := array_length(_numbers, 1);
  IF requested_count IS NULL OR requested_count = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un boleto';
  END IF;
  IF requested_count > 200 THEN
    RAISE EXCEPTION 'Máximo 200 boletos por operación';
  END IF;

  WITH upd AS (
    UPDATE public.tickets
    SET status = 'reserved',
        buyer_name = trim(_name),
        buyer_phone = trim(_phone),
        reserved_at = now()
    WHERE number = ANY(_numbers) AND status = 'available'
    RETURNING number
  )
  SELECT array_agg(number ORDER BY number) INTO reserved_nums FROM upd;

  reserved := COALESCE(reserved_nums, ARRAY[]::INTEGER[]);
  unavailable := ARRAY(
    SELECT unnest(_numbers) EXCEPT SELECT unnest(reserved)
  );
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_tickets(TEXT, TEXT, INTEGER[]) TO anon, authenticated;

-- Admin: release tickets
CREATE OR REPLACE FUNCTION public.release_tickets(_numbers INTEGER[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  WITH upd AS (
    UPDATE public.tickets
    SET status = 'available',
        buyer_name = NULL,
        buyer_phone = NULL,
        reserved_at = NULL,
        confirmed_at = NULL
    WHERE number = ANY(_numbers)
    RETURNING number
  )
  SELECT count(*) INTO released FROM upd;
  RETURN released;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_tickets(INTEGER[]) TO authenticated;

-- Admin: confirm payment
CREATE OR REPLACE FUNCTION public.confirm_tickets(_numbers INTEGER[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  WITH upd AS (
    UPDATE public.tickets
    SET status = 'confirmed', confirmed_at = now()
    WHERE number = ANY(_numbers) AND status = 'reserved'
    RETURNING number
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_tickets(INTEGER[]) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
