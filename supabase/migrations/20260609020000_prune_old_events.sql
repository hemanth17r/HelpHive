-- =============================================================================
-- HelpHive: Automatic App Events Pruning (30 Days Retention)
--
-- This migration enables the pg_cron extension and schedules a daily job
-- to delete app_events older than 30 days to keep the database slim.
-- =============================================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Clean up any existing job with the same name to prevent duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-old-app-events') THEN
      PERFORM cron.unschedule('prune-old-app-events');
    END IF;
  END IF;
END $$;

-- 3. Schedule the daily pruning job (runs every day at 1 AM)
SELECT cron.schedule(
  'prune-old-app-events',
  '0 1 * * *',
  $$ DELETE FROM public.app_events WHERE created_at < NOW() - INTERVAL '30 days' $$
);
