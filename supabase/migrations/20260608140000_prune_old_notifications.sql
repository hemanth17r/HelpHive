-- =============================================================================
-- HelpHive: Automatic Notification Pruning (7 Days Retention)
--
-- This migration enables the pg_cron extension and schedules a daily job
-- to delete notifications older than 7 days to keep the database slim.
-- =============================================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Clean up any existing job with the same name to prevent duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-old-notifications') THEN
      PERFORM cron.unschedule('prune-old-notifications');
    END IF;
  END IF;
END $$;

-- 3. Schedule the daily pruning job (runs every day at midnight)
SELECT cron.schedule(
  'prune-old-notifications',
  '0 0 * * *',
  $$ DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '7 days' $$
);
