-- Enable Supabase Realtime for user_locations table safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'user_locations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
    END IF;
  END IF;
END $$;
