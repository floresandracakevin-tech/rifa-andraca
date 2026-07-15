-- Remove the overly permissive SELECT policy that exposes all columns
DROP POLICY IF EXISTS "anyone reads ticket status" ON public.tickets;

-- Anon should not read the base table directly at all
REVOKE SELECT ON public.tickets FROM anon;

-- Recreate the public view as owner-rights (security_definer) so it can read the base table
-- but only expose the safe columns number and status
DROP VIEW IF EXISTS public.tickets_public;
CREATE VIEW public.tickets_public
  AS SELECT number, status FROM public.tickets;

-- Grant public read access only to the limited view
GRANT SELECT ON public.tickets_public TO anon, authenticated;

-- Authenticated users still read the base table only through the admin RLS policy
GRANT SELECT ON public.tickets TO authenticated;