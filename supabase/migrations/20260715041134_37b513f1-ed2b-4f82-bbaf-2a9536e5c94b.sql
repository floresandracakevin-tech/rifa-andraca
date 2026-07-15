-- Remove the SECURITY DEFINER view
DROP VIEW IF EXISTS public.tickets_public;

-- Create the public status table (no sensitive columns)
CREATE TABLE IF NOT EXISTS public.tickets_status (
  number integer PRIMARY KEY REFERENCES public.tickets(number) ON DELETE CASCADE,
  status text NOT NULL
);

GRANT SELECT ON public.tickets_status TO anon, authenticated;
GRANT ALL ON public.tickets_status TO service_role;

ALTER TABLE public.tickets_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public reads tickets_status" ON public.tickets_status;
CREATE POLICY "public reads tickets_status"
  ON public.tickets_status
  FOR SELECT TO anon, authenticated
  USING (true);

-- Sync current status from tickets
TRUNCATE public.tickets_status;
INSERT INTO public.tickets_status (number, status)
SELECT number, status FROM public.tickets;

-- Trigger function to keep tickets_status in sync with tickets
CREATE OR REPLACE FUNCTION public.sync_tickets_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tickets_status (number, status) VALUES (NEW.number, NEW.status);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.tickets_status SET status = NEW.status WHERE number = NEW.number;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.tickets_status WHERE number = OLD.number;
    RETURN OLD;
  END IF;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS tickets_status_sync ON public.tickets;
CREATE TRIGGER tickets_status_sync
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_tickets_status();

-- Ensure base table is not directly readable by anon
REVOKE SELECT ON public.tickets FROM anon;

-- Base table SELECT for authenticated remains gated by admin RLS policy
GRANT SELECT ON public.tickets TO authenticated;