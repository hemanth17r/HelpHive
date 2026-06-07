-- Enable Replica Identity so full rows are sent for updates/deletes
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Ensure supabase_realtime publication exists and tables are added to it
-- By default, Supabase creates supabase_realtime publication
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END$$;
  
  -- Add tables if not already in publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
