-- =============================================================
-- Third-Round Deep Audit Fixes – HelpHive V2
-- 2026-06-18
-- =============================================================

-- ----------------------------------------------------------
-- FIX 1: Profiles Privilege Escalation Guard
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_profile_is_admin_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND NEW.is_admin = true THEN
        -- Only allow if the caller is already an admin
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE auth_id = auth.uid() AND is_admin = true
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only administrators can grant admin privileges.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_profile_is_admin ON public.profiles;
CREATE TRIGGER tr_check_profile_is_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_is_admin_update();


-- ----------------------------------------------------------
-- FIX 2: Security Checks on Job Offer Management RPCs
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR;
    v_v2_status public.job_status_enum;
    v_people_needed INTEGER;
    v_accepted_count INTEGER;
BEGIN
    -- Authorization Check
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_tasker_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this profile.';
    END IF;

    -- 1. Lock the job row for update to prevent concurrent race conditions
    SELECT status, v2_status, people_needed INTO v_job_status, v_v2_status, v_people_needed
    FROM public.jobs
    WHERE id = p_job_id
    FOR UPDATE;

    -- 2. Validate job is still available
    IF v_job_status IN ('completed', 'cancelled') OR v_v2_status IN ('completed', 'cancelled') THEN
        RETURN FALSE;
    END IF;

    -- 3. Check if all slots are already filled
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    IF v_accepted_count >= v_people_needed THEN
        RETURN FALSE;
    END IF;

    -- 4. Security Check: Validate that a pending offer actually exists for the calling tasker
    IF NOT EXISTS (
        SELECT 1 FROM public.job_offers 
        WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending'
    ) THEN
        RETURN FALSE;
    END IF;

    -- 5. Accept the job offer
    UPDATE public.job_offers 
    SET status = 'accepted'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';

    -- 6. Recalculate accepted count
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    -- 7. If all slots are filled, close the job and expire remaining offers
    IF v_accepted_count >= v_people_needed THEN
        UPDATE public.job_offers
        SET status = 'expired'
        WHERE job_id = p_job_id AND status = 'pending';

        UPDATE public.jobs
        SET tasker_id = p_tasker_id, -- Keep last accepted tasker for legacy column compatibility
            status = 'accepted',
            v2_status = 'accepted'
        WHERE id = p_job_id;
    ELSE
        -- If more helpers are needed, keep job searching in DB
        UPDATE public.jobs
        SET tasker_id = p_tasker_id
        WHERE id = p_job_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.decline_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Authorization Check
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_tasker_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this profile.';
    END IF;

    UPDATE public.job_offers
    SET status = 'rejected'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.cancel_accepted_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR;
    v_v2_status public.job_status_enum;
    v_people_needed INTEGER;
    v_accepted_count INTEGER;
BEGIN
    -- Authorization Check
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_tasker_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this profile.';
    END IF;

    -- 1. Lock the job row for update to prevent concurrent race conditions
    SELECT status, v2_status, people_needed INTO v_job_status, v_v2_status, v_people_needed
    FROM public.jobs
    WHERE id = p_job_id
    FOR UPDATE;

    -- 2. Validate job status is active/accepted
    IF v_job_status IN ('completed', 'cancelled') OR v_v2_status IN ('completed', 'cancelled') THEN
        RETURN FALSE;
    END IF;

    -- 3. Check if this tasker actually has an accepted offer
    IF NOT EXISTS (
        SELECT 1 FROM public.job_offers 
        WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'accepted'
    ) THEN
        RETURN FALSE;
    END IF;

    -- 5. Set the offer status to 'rejected' to permanently exclude them
    UPDATE public.job_offers
    SET status = 'rejected'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'accepted';

    -- 6. Count how many accepted taskers are left
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    -- 7. Put the job back to searching / open
    UPDATE public.jobs
    SET status = 'open',
        v2_status = 'searching',
        tasker_id = NULL
    WHERE id = p_job_id;

    -- Delete expired offers so they can be re-invited/matched
    DELETE FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'expired';

    -- 8. If there are remaining taskers, update legacy tasker_id to one of them
    IF v_accepted_count > 0 THEN
        UPDATE public.jobs
        SET tasker_id = (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id AND status = 'accepted' LIMIT 1)
        WHERE id = p_job_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.commit_partial_crew(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_accepted_count INTEGER;
BEGIN
    -- Authorization Check: Caller must be the job poster
    IF NOT EXISTS (
        SELECT 1 FROM public.jobs
        WHERE id = p_job_id
          AND poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the job poster can commit the crew.';
    END IF;

    -- Count accepted taskers
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    IF v_accepted_count = 0 THEN
        RETURN FALSE;
    END IF;

    -- Update job to match current count and finalize acceptance
    UPDATE public.jobs
    SET people_needed = v_accepted_count,
        status = 'accepted',
        v2_status = 'accepted'
    WHERE id = p_job_id;

    -- Expire any remaining pending offers
    UPDATE public.job_offers
    SET status = 'expired'
    WHERE job_id = p_job_id AND status = 'pending';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------
-- FIX 3: submit_user_rating – enforce poster caller identity
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_user_rating(
  p_job_id UUID,
  p_giver_role TEXT,           -- 'poster' or 'tasker'
  p_receiver_profile_id UUID,
  p_rating INTEGER,
  p_badge_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job              RECORD;
  v_giver_profile_id UUID;
  v_giver_auth_id    UUID;
  v_receiver_auth_id UUID;
  v_new_rating       NUMERIC;
  v_new_tasks        INTEGER;
  v_role_context     TEXT;
BEGIN
  -- 1. Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- 2. Resolve caller profile and auth_id (caller MUST be the giver)
  SELECT id, auth_id
  INTO v_giver_profile_id, v_giver_auth_id
  FROM public.profiles
  WHERE auth_id = auth.uid();

  IF v_giver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized rating submission';
  END IF;

  -- 3. Determine role context and validate participation & caller matches poster/tasker
  IF p_giver_role = 'poster' THEN
    v_role_context := 'tasker';
    IF v_giver_profile_id <> v_job.poster_id THEN
      RAISE EXCEPTION 'Unauthorized: Giver is not the poster of this job';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id
        AND tasker_id = p_receiver_profile_id
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Receiver did not participate in this job';
    END IF;
  ELSIF p_giver_role = 'tasker' THEN
    v_role_context := 'poster';
    IF p_receiver_profile_id <> v_job.poster_id THEN
      RAISE EXCEPTION 'Receiver is not the poster of this job';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id
        AND tasker_id = v_giver_profile_id
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Giver did not participate in this job';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid role context';
  END IF;

  -- 4. Resolve receiver auth_id
  SELECT auth_id INTO v_receiver_auth_id
  FROM public.profiles
  WHERE id = p_receiver_profile_id;

  IF v_receiver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Receiver profile not found';
  END IF;

  -- 5. Duplicate-rating guard – prevent spam
  IF EXISTS (
    SELECT 1 FROM public.feedbacks
    WHERE giver_id      = v_giver_auth_id
      AND job_id        = p_job_id
      AND role_context  = v_role_context
  ) THEN
    RAISE EXCEPTION 'Rating already submitted for this job';
  END IF;

  -- 6. Insert the feedback row
  INSERT INTO public.feedbacks (giver_id, receiver_id, job_id, rating, role_context)
  VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_rating, v_role_context);

  -- 7. Insert badge if provided
  IF p_badge_type IS NOT NULL AND p_badge_type <> '' THEN
    INSERT INTO public.reputation_badges (giver_id, receiver_id, job_id, badge_type, role_context)
    VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_badge_type, v_role_context);
  END IF;

  -- 8. Recalculate and update receiver profile rating
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_new_rating, v_new_tasks
  FROM public.feedbacks
  WHERE receiver_id = v_receiver_auth_id
    AND role_context = v_role_context;

  UPDATE public.profiles
  SET rating          = v_new_rating,
      tasks_completed = v_new_tasks
  WHERE id = p_receiver_profile_id;

  RETURN TRUE;
END;
$$;


-- ----------------------------------------------------------
-- FIX 4: Admin Dashboard Stats and Analytics RPC Locks
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_jobs', (SELECT COUNT(*) FROM public.jobs),
    'total_events', (SELECT COUNT(*) FROM public.app_events),
    'events_today', (SELECT COUNT(*) FROM public.app_events WHERE created_at >= CURRENT_DATE),
    'users_today', (SELECT COUNT(DISTINCT user_id) FROM public.app_events WHERE created_at >= CURRENT_DATE),
    'active_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status IN ('open', 'accepted')),
    'job_status_counts', (
       SELECT jsonb_object_agg(status, count) FROM (
         SELECT status, COUNT(*) as count 
         FROM public.jobs 
         GROUP BY status
       ) s
    )
  ) INTO v_stats;
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_event_counts(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.get_event_counts(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS TABLE(event_type TEXT, count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT ae.event_type, COUNT(*)
  FROM public.app_events ae
  WHERE ae.created_at >= p_start_date AND ae.created_at <= p_end_date
  GROUP BY ae.event_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_daily_event_timeseries(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.get_daily_event_timeseries(p_event_type TEXT, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS TABLE(day DATE, count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT ae.created_at::DATE, COUNT(*)
  FROM public.app_events ae
  WHERE ae.event_type = p_event_type AND ae.created_at >= p_start_date AND ae.created_at <= p_end_date
  GROUP BY ae.created_at::DATE
  ORDER BY ae.created_at::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_recent_events(INTEGER);
CREATE OR REPLACE FUNCTION public.get_recent_events(p_limit INTEGER)
RETURNS TABLE(
  id UUID,
  event_type TEXT,
  user_id UUID,
  user_name TEXT,
  user_phone TEXT,
  active_role TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT 
    ae.id,
    ae.event_type,
    ae.user_id,
    p.name as user_name,
    p.phone as user_phone,
    ae.active_role,
    ae.entity_id,
    ae.metadata,
    ae.created_at
  FROM public.app_events ae
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_demand_hotspots(VARCHAR, INTEGER);
CREATE OR REPLACE FUNCTION public.get_demand_hotspots(p_category_id VARCHAR, p_radius_meters INTEGER)
RETURNS TABLE(lat DOUBLE PRECISION, lng DOUBLE PRECISION, density BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT 
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    COUNT(*) as density
  FROM public.jobs
  WHERE (p_category_id IS NULL OR skill_id = p_category_id)
  GROUP BY location;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_coverage_gaps(VARCHAR, INTEGER);
CREATE OR REPLACE FUNCTION public.get_coverage_gaps(p_category_id VARCHAR, p_radius_meters INTEGER)
RETURNS TABLE(lat DOUBLE PRECISION, lng DOUBLE PRECISION, waitlist_count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT 
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    COUNT(*) as waitlist_count
  FROM public.hirer_waitlists
  WHERE (p_category_id IS NULL OR category_id = p_category_id)
  GROUP BY location;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_failed_first_experiences(INTEGER);
CREATE OR REPLACE FUNCTION public.get_failed_first_experiences(p_limit INTEGER)
RETURNS TABLE(
  poster_id UUID,
  poster_name TEXT,
  job_id UUID,
  category_id VARCHAR,
  failure_reason TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as poster_id,
    p.name as poster_name,
    j.id as job_id,
    j.skill_id as category_id,
    (ae.metadata->>'reason') as failure_reason,
    ae.created_at
  FROM public.app_events ae
  JOIN public.jobs j ON j.id = ae.entity_id
  JOIN public.profiles p ON p.id = j.poster_id
  WHERE ae.event_type = 'job_expired'
    AND NOT EXISTS (
      -- Check if poster has any completed jobs prior to this
      SELECT 1 FROM public.jobs j2
      WHERE j2.poster_id = p.id 
        AND j2.status = 'completed'
        AND j2.created_at < ae.created_at
    )
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------
-- FIX 5: Drop and Recreate FK Constraints to profiles table
-- ----------------------------------------------------------
-- Drop old foreign key constraints referencing auth.users(id)
ALTER TABLE public.app_events DROP CONSTRAINT IF EXISTS app_events_user_id_fkey;
ALTER TABLE public.help_reports DROP CONSTRAINT IF EXISTS help_reports_user_id_fkey;

-- Re-reference public.profiles(id) for help_reports.user_id
ALTER TABLE public.help_reports 
  ADD CONSTRAINT help_reports_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ----------------------------------------------------------
-- FIX 6: Redefine RLS Policies on help_reports & app_events
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all help reports" ON public.help_reports;
DROP POLICY IF EXISTS "Users can view own help reports" ON public.help_reports;
DROP POLICY IF EXISTS "Anyone can insert help reports" ON public.help_reports;

CREATE POLICY "Users can view own help reports"
ON public.help_reports FOR SELECT
USING (
  user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Anyone can insert help reports"
ON public.help_reports FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  OR user_id IS NULL
);

DROP POLICY IF EXISTS "Users can read own events" ON public.app_events;
CREATE POLICY "Users can read own events"
ON public.app_events FOR SELECT
USING (
  user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own events" ON public.app_events;
DROP POLICY IF EXISTS "Allow anon to manage app_events" ON public.app_events;

CREATE POLICY "Allow anon to manage app_events"
ON public.app_events FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  OR user_id IS NULL
);


-- ----------------------------------------------------------
-- FIX 7: Client-Side Job State Modification Guard
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_job_restricted_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent modifying critical columns once job is created, unless caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE auth_id = auth.uid() AND is_admin = true
    ) THEN
        IF NEW.poster_id IS DISTINCT FROM OLD.poster_id THEN
            RAISE EXCEPTION 'Cannot update poster_id on a job';
        END IF;
        IF NEW.amount IS DISTINCT FROM OLD.amount THEN
            RAISE EXCEPTION 'Cannot update job payout amount';
        END IF;
        IF NEW.skill_id IS DISTINCT FROM OLD.skill_id THEN
            RAISE EXCEPTION 'Cannot update job category (skill_id)';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_job_restricted_updates ON public.jobs;
CREATE TRIGGER tr_check_job_restricted_updates
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.check_job_restricted_updates();


-- ----------------------------------------------------------
-- FIX 8: spatial query GiST optimizations
-- ----------------------------------------------------------
-- Redefine get_local_supply to pre-filter location distance using index-friendly p_radius_meters
DROP FUNCTION IF EXISTS public.get_local_supply(VARCHAR, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
CREATE OR REPLACE FUNCTION public.get_local_supply(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_target_location GEOGRAPHY(POINT);
BEGIN
    v_target_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE role = 'tasker'
      AND is_online = true
      AND p_category_id = ANY(skills)
      AND ST_DWithin(location, v_target_location, p_radius_meters) -- Uses GiST index
      AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters))
      AND id NOT IN (
          SELECT tasker_id 
          FROM public.jobs 
          WHERE tasker_id IS NOT NULL 
            AND v2_status IN ('accepted', 'in_progress')
      );

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Redefine dispatch_job_wave to leverage the GiST index and check category coverage radius
DROP FUNCTION IF EXISTS public.dispatch_job_wave(UUID, INT);
CREATE OR REPLACE FUNCTION public.dispatch_job_wave(p_job_id UUID, p_wave_number INT)
RETURNS INTEGER AS $$
DECLARE
    v_job RECORD;
    v_behavior RECORD;
    v_target_location GEOGRAPHY(POINT);
    v_radius_m INTEGER;
    v_stage VARCHAR;
    v_tasker_record RECORD;
    v_offers_created INTEGER := 0;
    
    -- Active pool parameters
    v_pool_config JSONB;
    v_growth_days INTEGER;
    v_mature_hours INTEGER;
    v_tasker_radius INTEGER;
    
    -- Sequential dispatch parameters
    v_target_active INTEGER;
    v_active_offers INTEGER;
    v_needed_offers INTEGER;
    v_accepted_offers INTEGER;
    v_remaining_needed INTEGER;
    
    -- Expiration parameters
    v_expires_interval INTERVAL;
BEGIN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- Get matching behavior
    SELECT mb.* INTO v_behavior
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = v_job.skill_id;

    IF NOT FOUND THEN
        SELECT * INTO v_behavior FROM public.matching_behaviors WHERE name = 'on_location' LIMIT 1;
    END IF;

    -- Determine center location
    IF v_behavior.location_strategy = 'primary_location' THEN
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    ELSIF v_behavior.location_strategy = 'secondary_location' THEN
        v_target_location := COALESCE(v_job.secondary_location, v_job.primary_location, v_job.location);
    ELSE
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    END IF;

    -- Determine radius based on wave number
    IF p_wave_number = 1 THEN v_radius_m := v_behavior.wave1_radius_m;
    ELSIF p_wave_number = 2 THEN v_radius_m := v_behavior.wave2_radius_m;
    ELSE v_radius_m := v_behavior.wave3_radius_m;
    END IF;

    -- Get marketplace stage and pool configurations
    v_stage := public.get_marketplace_stage(v_job.skill_id, ST_Y(v_target_location::geometry), ST_X(v_target_location::geometry), 20000);
    
    SELECT value INTO v_pool_config FROM public.marketplace_configurations WHERE key = 'active_pool_rules';
    v_growth_days := COALESCE((v_pool_config->>'growth_active_days')::INTEGER, 7);
    v_mature_hours := COALESCE((v_pool_config->>'mature_active_hours')::INTEGER, 24);

    -- Calculate remaining helpers needed
    SELECT count(*) INTO v_accepted_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    v_remaining_needed := COALESCE(v_job.people_needed, 1) - v_accepted_offers;
    IF v_remaining_needed <= 0 THEN
        RETURN 0;
    END IF;

    -- Define target active offers and expiration times based on stage and remaining helpers needed
    IF v_stage = 'bootstrap' THEN
        v_target_active := 10 * p_wave_number * v_remaining_needed; -- Broadcast
        v_expires_interval := interval '10 minutes';
    ELSIF v_stage = 'growth' THEN
        v_target_active := 5 * p_wave_number * v_remaining_needed;
        v_expires_interval := interval '5 minutes';
    ELSE
        v_target_active := 2 * p_wave_number * v_remaining_needed;  -- Strict matching
        v_expires_interval := interval '2 minutes';
    END IF;

    -- Count active pending offers for this job
    SELECT count(*) INTO v_active_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'pending';

    v_needed_offers := v_target_active - v_active_offers;
    IF v_needed_offers <= 0 THEN
        RETURN 0;
    END IF;

    -- Find and loop through eligible taskers (Sorted by distance, excluding busy/accepted taskers)
    FOR v_tasker_record IN
        SELECT id, location, coverage_radius, category_coverage, last_active_at, is_online 
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND v_job.skill_id = ANY(skills)
          AND id != v_job.poster_id
          AND id NOT IN (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id)
          AND id NOT IN (
              SELECT tasker_id 
              FROM public.jobs 
              WHERE tasker_id IS NOT NULL 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          )
          AND id NOT IN (
              SELECT jo.tasker_id
              FROM public.job_offers jo
              JOIN public.jobs j ON j.id = jo.job_id
              WHERE jo.status = 'accepted'
                AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress')
          )
          -- GiST spatial index friendly filter checks
          AND (v_behavior.location_strategy = 'remote' OR ST_DWithin(location, v_target_location, v_radius_m))
          AND (v_behavior.location_strategy = 'remote' OR ST_DWithin(location, v_target_location, 50000))
        ORDER BY location <-> v_target_location -- KNN Distance Sort (closest first)
    LOOP
        -- Resolve category-specific radius or fall back to profile-wide coverage_radius
        v_tasker_radius := COALESCE(
            (v_tasker_record.category_coverage->>v_job.skill_id)::INTEGER, 
            v_tasker_record.coverage_radius, 
            5000
        );

        -- Proximity range check against tasker custom coverage radius
        IF v_behavior.location_strategy != 'remote' THEN
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Stage-aware active pool rules
        IF v_stage = 'growth' THEN
            IF v_tasker_record.last_active_at < (now() - (v_growth_days || ' days')::interval) THEN
                CONTINUE;
            END IF;
        ELSIF v_stage = 'mature' THEN
            IF v_tasker_record.last_active_at < (now() - (v_mature_hours || ' hours')::interval) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Dispatch the offer
        INSERT INTO public.job_offers (
            job_id, tasker_id, status, amount_offered, wave_number, expires_at
        ) VALUES (
            p_job_id, v_tasker_record.id, 'pending', v_job.amount, p_wave_number, now() + v_expires_interval
        );
        
        v_offers_created := v_offers_created + 1;
        EXIT WHEN v_offers_created >= v_needed_offers;
    END LOOP;

    -- Update tracking wave atomically
    UPDATE public.jobs 
    SET max_wave_dispatched = p_wave_number 
    WHERE id = p_job_id;

    RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------
-- FIX 9: profiles waitlist trigger performance optimization
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_supply_unlock()
RETURNS TRIGGER AS $$
DECLARE
    v_waitlist_record RECORD;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- Optimize trigger execution: exit early if this is an update but online status, location, and skills did not change
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.is_online = NEW.is_online) AND (OLD.location = NEW.location) AND (OLD.skills = NEW.skills) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Only run for online active taskers with location and skills
    IF NEW.role != 'tasker' OR NEW.is_online != true OR NEW.location IS NULL OR NEW.skills IS NULL OR array_length(NEW.skills, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find waitlist entries that match any of the tasker's skills and are within coverage
    FOR v_waitlist_record IN 
        SELECT id, poster_id, category_id
        FROM public.hirer_waitlists
        WHERE category_id = ANY(NEW.skills)
          AND ST_DWithin(NEW.location, location, COALESCE(NEW.coverage_radius, 20000))
    LOOP
        -- Human-readable category label mapping
        CASE v_waitlist_record.category_id
            WHEN 'errands' THEN v_category_label := 'Errands & Deliveries';
            WHEN 'personal_assistance' THEN v_category_label := 'Personal Assistance';
            WHEN 'moving' THEN v_category_label := 'Moving & Lifting';
            WHEN 'local_helpers' THEN v_category_label := 'Local Helpers';
            WHEN 'events' THEN v_category_label := 'Events & Staffing';
            WHEN 'creative' THEN v_category_label := 'Creative Services';
            ELSE v_category_label := 'Task';
        END CASE;

        -- Send push notification via edge function
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', v_waitlist_record.poster_id,
                'title', v_category_label || ' unlocked!',
                'body', 'Good news! A tasker is now available for ' || v_category_label || ' in your area. Post your job today!',
                'action_url', 'post_job',
                'type', 'waitlist_unlock',
                'role', 'poster'
            ),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', v_apikey,
                'Authorization', 'Bearer ' || v_apikey
            )
        );

        -- Delete from waitlist to prevent duplicate notifications
        DELETE FROM public.hirer_waitlists WHERE id = v_waitlist_record.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------
-- FIX 10: auto_dispatch_job_waves connection locking removal
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_dispatch_waves_internal()
RETURNS void AS $$
DECLARE
    v_job RECORD;
    v_age INTERVAL;
    v_active_offers INTEGER;
    v_accepted_offers INTEGER;
BEGIN
    -- advisory lock to prevent overlapping runs from cron ticks
    IF NOT pg_try_advisory_xact_lock(9876543) THEN
        RETURN;
    END IF;

    -- 0. Clean up: Expire all pending offers whose expires_at has passed
    UPDATE public.job_offers
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();

    FOR v_job IN 
        SELECT id, created_at, COALESCE(max_wave_dispatched, 0) as max_wave_dispatched, people_needed 
        FROM public.jobs 
        WHERE v2_status = 'searching' 
          AND status = 'open'
    LOOP
        v_age := now() - v_job.created_at;

        -- Check if all needed helpers have already accepted
        SELECT count(*) INTO v_accepted_offers
        FROM public.job_offers
        WHERE job_id = v_job.id AND status = 'accepted';

        IF v_accepted_offers >= v_job.people_needed THEN
            -- Close job as fully matched
            UPDATE public.jobs
            SET status = 'accepted',
                v2_status = 'accepted'
            WHERE id = v_job.id;
            
            UPDATE public.job_offers
            SET status = 'expired'
            WHERE job_id = v_job.id AND status = 'pending';
            
            CONTINUE;
        END IF;

        -- 1. Recycle Loop: If Wave 3 finished and all offers expired/rejected, restart cycle
        IF v_job.max_wave_dispatched = 3 THEN
            SELECT count(*) INTO v_active_offers
            FROM public.job_offers
            WHERE job_id = v_job.id AND status = 'pending';
            
            IF v_active_offers = 0 THEN
                -- Delete ONLY expired offers, leaving 'rejected' offers to permanently exclude those taskers
                DELETE FROM public.job_offers
                WHERE job_id = v_job.id AND status = 'expired';
                
                -- Reset wave counter to trigger fresh Wave 1 matching
                UPDATE public.jobs
                SET max_wave_dispatched = 0,
                    created_at = now() -- Reset timing reference
                WHERE id = v_job.id;
                
                CONTINUE;
            END IF;
        END IF;
        
        -- 2. Wave 1 dispatch & top-up
        IF v_job.max_wave_dispatched = 0 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 1);
        END IF;

        -- 3. Wave 2 dispatch & top-up: age >= 1 minute, and max_wave_dispatched = 1
        IF v_age >= interval '1 minute' AND v_job.max_wave_dispatched = 1 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 2);
        END IF;
        
        -- 4. Wave 3 dispatch & top-up: age >= 2 minutes, and max_wave_dispatched = 2
        IF v_age >= interval '2 minutes' AND v_job.max_wave_dispatched = 2 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 3);
        END IF;

        -- 5. Replacement Matching: If a slot becomes vacant (due to reject/expire) before fully matched
        IF v_job.max_wave_dispatched > 0 THEN
            PERFORM public.dispatch_job_wave(v_job.id, v_job.max_wave_dispatched);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.auto_dispatch_job_waves()
RETURNS void AS $$
BEGIN
    -- Execute matching wave check in a single fast call without transaction sleep loops
    PERFORM public.check_and_dispatch_waves_internal();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------
-- FIX 11: RLS Address Book Updates
-- ----------------------------------------------------------
-- Update the user_addresses SELECT policy to allow reading any address linked to a job
DROP POLICY IF EXISTS "Users can read own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Addresses of jobs are viewable" ON public.user_addresses;

CREATE POLICY "Addresses of jobs are viewable"
ON public.user_addresses FOR SELECT
USING (
  user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  OR id IN (SELECT primary_address_id FROM public.jobs)
  OR id IN (SELECT secondary_address_id FROM public.jobs)
);


-- ----------------------------------------------------------
-- FIX 12: Tighten Notifications INSERT policy
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications" 
ON public.notifications FOR INSERT 
TO authenticated
WITH CHECK (true);


-- ----------------------------------------------------------
-- FIX 13: Missing FK Indexes
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON public.jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tasker_id ON public.jobs(tasker_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
