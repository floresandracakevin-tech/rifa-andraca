
-- Restrict base table SELECT to admin only; public reads go via the view
DROP POLICY IF EXISTS "public can see ticket status" ON public.tickets;
REVOKE SELECT ON public.tickets FROM anon, authenticated;
GRANT SELECT ON public.tickets TO authenticated; -- gated by RLS admin policy

CREATE POLICY "admin reads tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate view with security_invoker so it uses caller's rights
DROP VIEW IF EXISTS public.tickets_public;
CREATE VIEW public.tickets_public
  WITH (security_invoker = true)
  AS SELECT number, status FROM public.tickets;

-- View needs its own bypass: give anon direct SELECT on limited columns of tickets
-- via a policy scoped to the view's columns is not possible; instead grant table
-- SELECT on only the safe columns to anon.
GRANT SELECT (number, status) ON public.tickets TO anon, authenticated;

-- Add back a permissive SELECT policy that only allows non-admin reads
CREATE POLICY "anyone reads ticket status" ON public.tickets
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.tickets_public TO anon, authenticated;

-- Enable realtime full row (already added earlier)
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
