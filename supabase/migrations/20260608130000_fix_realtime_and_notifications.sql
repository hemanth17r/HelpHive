-- =============================================================================
-- HelpHive: Fix Realtime Publication & Notification RLS
--
-- The previous realtime migration (20260607112250) had broken SQL syntax
-- (BEGIN; ... EXCEPTION ... END; is not valid outside PL/pgSQL blocks).
-- This migration properly ensures:
-- 1. REPLICA IDENTITY FULL on jobs and notifications
-- 2. Both tables are in the supabase_realtime publication
-- 3. All notification/push_subscriptions RLS policies are anon-safe
-- =============================================================================

-- ─── 1. Ensure REPLICA IDENTITY FULL ─────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'jobs') THEN
    ALTER TABLE public.jobs REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
  END IF;
END $$;

-- ─── 2. Add tables to supabase_realtime publication ──────────────────────
-- Use DO block to handle "already in publication" gracefully

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Fix notifications RLS (idempotent) ──────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    -- Drop all old policies
    DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications (e.g. mark as read)" ON public.notifications;
    DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Allow anon to manage notifications" ON public.notifications;

    -- Create single permissive policy for MVP (custom phone auth, no Supabase Auth)
    CREATE POLICY "Allow anon to manage notifications" ON public.notifications
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 4. Fix push_subscriptions RLS (idempotent) ─────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'push_subscriptions') THEN
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
    DROP POLICY IF EXISTS "Allow anon to manage push subscriptions" ON public.push_subscriptions;

    CREATE POLICY "Allow anon to manage push subscriptions" ON public.push_subscriptions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
