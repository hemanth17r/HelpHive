-- 20260613160000_production_rls_indexes.sql
-- Production DB Security and Scalability Migration

-------------------------------------------------------------------------------
-- 1. DROP INSECURE WIDE-OPEN POLICIES
-------------------------------------------------------------------------------
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND policyname LIKE 'Allow anon%' 
           OR policyname LIKE 'Public can insert%'
           OR policyname LIKE 'Users can update jobs.'
           OR policyname LIKE 'Jobs are viewable by everyone.'
           OR policyname LIKE 'Users can update own profile.'
           OR policyname LIKE 'Public profiles are viewable by everyone.'
           OR policyname LIKE 'Users can view own help reports'
           OR policyname LIKE 'Anyone can insert help reports'
           OR policyname LIKE 'Allow public insert to waitlist'
           OR policyname LIKE 'Users can update their own notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;


-------------------------------------------------------------------------------
-- 2. ENABLE RLS ON ALL TABLES (if not already)
-------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_reports ENABLE ROW LEVEL SECURITY;


-------------------------------------------------------------------------------
-- 3. PROFILES POLICIES
-------------------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth_id = auth.uid() OR auth_id IS NULL);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth_id = auth.uid() OR auth_id IS NULL);

CREATE POLICY "Users can delete own profile" 
ON public.profiles FOR DELETE 
USING (auth_id = auth.uid());


-------------------------------------------------------------------------------
-- 4. JOBS POLICIES
-------------------------------------------------------------------------------
CREATE POLICY "Jobs are viewable by everyone" 
ON public.jobs FOR SELECT USING (true);

CREATE POLICY "Users can insert jobs as poster" 
ON public.jobs FOR INSERT 
WITH CHECK (poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update jobs they posted or are assigned to" 
ON public.jobs FOR UPDATE 
USING (
    poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()) OR 
    tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
);

CREATE POLICY "Users can delete their own jobs" 
ON public.jobs FOR DELETE 
USING (poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));


-------------------------------------------------------------------------------
-- 5. JOB OFFERS POLICIES
-------------------------------------------------------------------------------
-- RPCs handle INSERT/UPDATE/DELETE. Only SELECT is needed.
CREATE POLICY "Taskers can view their own job offers" 
ON public.job_offers FOR SELECT 
USING (tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));


-------------------------------------------------------------------------------
-- 6. USER ADDRESSES, LOCATIONS, PUSH SUBSCRIPTIONS
-------------------------------------------------------------------------------
-- user_addresses
CREATE POLICY "Users can manage their own addresses" 
ON public.user_addresses FOR ALL 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- user_locations
CREATE POLICY "Users can manage their own locations" 
ON public.user_locations FOR ALL 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions" 
ON public.push_subscriptions FOR ALL 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));


-------------------------------------------------------------------------------
-- 7. NOTIFICATIONS, APP_EVENTS, HELP_REPORTS
-------------------------------------------------------------------------------
-- notifications
CREATE POLICY "Anyone can insert notifications" 
ON public.notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage their own notifications" 
ON public.notifications FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete their own notifications" 
ON public.notifications FOR DELETE 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- app_events
CREATE POLICY "Anyone can log events" 
ON public.app_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own events" 
ON public.app_events FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- help_reports
CREATE POLICY "Anyone can submit help reports" 
ON public.help_reports FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own reports" 
ON public.help_reports FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));


-------------------------------------------------------------------------------
-- 8. ADD MISSING POSTGIS INDEXES
-------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON public.jobs USING GIST (location);
