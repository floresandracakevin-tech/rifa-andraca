ALTER PUBLICATION supabase_realtime DROP TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_status;
ALTER TABLE public.tickets REPLICA IDENTITY DEFAULT;
ALTER TABLE public.tickets_status REPLICA IDENTITY FULL;