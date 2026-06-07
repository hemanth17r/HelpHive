-- =============================================================================
-- HelpHive: Comprehensive Schema & RLS Fix Migration
-- 
-- This migration ensures:
-- 1. skills (JSONB) and upi_id (TEXT) columns exist on profiles
-- 2. All RLS policies that depend on auth.uid() are replaced with anon-safe 
--    policies, since HelpHive uses custom phone auth (not Supabase Auth)
-- 3. profiles table RLS is enabled with a permissive policy
-- =============================================================================

-- ─── 1. Ensure columns exist on profiles ────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- ─── 2. Enable RLS on profiles with anon-safe policy ────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any restrictive auth.uid() policies that may exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon full access to profiles" ON public.profiles;

-- Allow anon access (MVP — custom auth, no Supabase Auth session)
CREATE POLICY "Allow anon full access to profiles" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. Fix app_events RLS ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated to insert events" ON public.app_events;
DROP POLICY IF EXISTS "Allow anon to manage app_events" ON public.app_events;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_events') THEN
    ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon to manage app_events" ON public.app_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 4. Fix user_locations RLS ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Allow anon to manage user_locations" ON public.user_locations;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_locations') THEN
    ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon to manage user_locations" ON public.user_locations
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 5. Fix reports RLS ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anon to manage reports" ON public.reports;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon to manage reports" ON public.reports
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 6. Fix feedbacks RLS ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can create feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can read feedbacks for their jobs" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow anon to manage feedbacks" ON public.feedbacks;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedbacks') THEN
    ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon to manage feedbacks" ON public.feedbacks
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 7. Fix reputation_badges RLS ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own badges" ON public.reputation_badges;
DROP POLICY IF EXISTS "Allow anon to manage reputation_badges" ON public.reputation_badges;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reputation_badges') THEN
    ALTER TABLE public.reputation_badges ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon to manage reputation_badges" ON public.reputation_badges
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 8. Fix waitlist RLS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users to insert into waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Allow anon to manage waitlist" ON public.waitlist;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'waitlist') THEN
    ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon to manage waitlist" ON public.waitlist
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
