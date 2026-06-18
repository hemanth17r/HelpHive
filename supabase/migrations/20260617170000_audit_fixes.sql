-- Redefine verify_job_otp to verify calling tasker has an accepted offer on the job
CREATE OR REPLACE FUNCTION public.verify_job_otp(p_job_id uuid, p_otp character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_job record;
  v_caller_profile_id uuid;
BEGIN
  -- Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  -- Ensure job exists
  IF v_job IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve caller's profile ID from auth_id
  SELECT id INTO v_caller_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  IF v_caller_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Security Check: Ensure the caller is an accepted tasker for this job
  IF NOT EXISTS (
    SELECT 1 FROM public.job_offers 
    WHERE job_id = p_job_id AND tasker_id = v_caller_profile_id AND status = 'accepted'
  ) THEN
    RETURN false;
  END IF;

  -- Verify OTP and atomically update the job status
  IF v_job.otp = p_otp THEN
    -- Only update status if it is currently in 'accepted' or 'active' state
    IF v_job.status = 'active' OR v_job.status = 'accepted' THEN
      UPDATE public.jobs 
      SET status = 'in_progress', 
          v2_status = 'in_progress'
      WHERE id = p_job_id;
    END IF;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$function$;


-- Redefine submit_user_rating to accept p_receiver_profile_id and validate multi-tasker connections
CREATE OR REPLACE FUNCTION public.submit_user_rating(
  p_job_id UUID,
  p_giver_role TEXT, -- 'poster' or 'tasker'
  p_receiver_profile_id UUID,
  p_rating INTEGER,
  p_badge_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_giver_profile_id UUID;
  v_giver_auth_id UUID;
  v_receiver_auth_id UUID;
  v_new_rating NUMERIC;
  v_new_tasks INTEGER;
  v_role_context TEXT;
BEGIN
  -- 1. Fetch the job details
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- 2. Identify Giver and validate participation
  IF p_giver_role = 'poster' THEN
    v_giver_profile_id := v_job.poster_id;
    v_role_context := 'tasker';
    -- Validate receiver has an accepted offer on the job
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id AND tasker_id = p_receiver_profile_id AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Receiver did not participate in this job';
    END IF;
  ELSIF p_giver_role = 'tasker' THEN
    v_role_context := 'poster';
    IF p_receiver_profile_id <> v_job.poster_id THEN
      RAISE EXCEPTION 'Receiver is not the poster of this job';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid role context';
  END IF;

  -- 3. Resolve auth_ids from profiles table (giver must be the caller)
  SELECT id, auth_id INTO v_giver_profile_id, v_giver_auth_id 
  FROM public.profiles 
  WHERE auth_id = auth.uid();

  IF v_giver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized rating submission';
  END IF;

  -- Double check tasker participation if tasker is rating poster
  IF p_giver_role = 'tasker' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id AND tasker_id = v_giver_profile_id AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Giver did not participate in this job';
    END IF;
  END IF;

  SELECT auth_id INTO v_receiver_auth_id FROM public.profiles WHERE id = p_receiver_profile_id;
  IF v_receiver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Receiver profile not found';
  END IF;

  -- 4. Insert rating row into feedbacks table
  INSERT INTO public.feedbacks (giver_id, receiver_id, job_id, rating, role_context)
  VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_rating, v_role_context);
  
  -- Insert badge if provided
  IF p_badge_type IS NOT NULL AND p_badge_type <> '' THEN
    INSERT INTO public.reputation_badges (giver_id, receiver_id, job_id, badge_type, role_context)
    VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_badge_type, v_role_context);
  END IF;

  -- 5. Calculate average rating and tasks completed, and update receiver profile
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_new_rating, v_new_tasks
  FROM public.feedbacks
  WHERE receiver_id = v_receiver_auth_id AND role_context = v_role_context;

  UPDATE public.profiles
  SET rating = v_new_rating,
      tasks_completed = v_new_tasks
  WHERE id = p_receiver_profile_id;

  RETURN TRUE;
END;
$$;


-- Create submit_user_report procedure
CREATE OR REPLACE FUNCTION public.submit_user_report(
  p_reported_profile_id UUID,
  p_job_id UUID,
  p_category TEXT,
  p_details TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reporter_auth_id UUID;
  v_reported_auth_id UUID;
BEGIN
  -- Resolve caller auth ID
  v_reporter_auth_id := auth.uid();
  IF v_reporter_auth_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized report submission';
  END IF;

  -- Resolve reported user's auth ID from profiles
  SELECT auth_id INTO v_reported_auth_id FROM public.profiles WHERE id = p_reported_profile_id;
  IF v_reported_auth_id IS NULL THEN
    RAISE EXCEPTION 'Reported user auth profile not found';
  END IF;

  -- Insert report row
  INSERT INTO public.reports (reporter_id, reported_user_id, job_id, category, details)
  VALUES (v_reporter_auth_id, v_reported_auth_id, p_job_id, p_category, p_details);

  RETURN TRUE;
END;
$$;


-- Redefine get_local_supply to filter out offline taskers
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


-- Redefine dispatch_job_wave to filter out offline taskers and select is_online
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
        v_target_active := 10 * p_wave_number * v_remaining_needed; -- Low traffic: Broadcast to get quick answers
        v_expires_interval := interval '10 minutes';
    ELSIF v_stage = 'growth' THEN
        v_target_active := 5 * p_wave_number * v_remaining_needed;  -- Medium traffic
        v_expires_interval := interval '5 minutes';
    ELSE
        v_target_active := 2 * p_wave_number * v_remaining_needed;  -- Mature/High traffic: Strict sequential queue matching
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
        SELECT id, location, coverage_radius, last_active_at, is_online 
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
        ORDER BY location <-> v_target_location -- KNN Distance Sort (closest first)
    LOOP
        v_tasker_radius := COALESCE(v_tasker_record.coverage_radius, 5000);

        -- Spatial range check
        IF v_behavior.location_strategy != 'remote' THEN
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) THEN
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


-- Update job_offers SELECT RLS policy to allow posters and coworkers
DROP POLICY IF EXISTS "Taskers can view their own job offers" ON public.job_offers;
DROP POLICY IF EXISTS "Users can view relevant job offers" ON public.job_offers;

CREATE POLICY "Users can view relevant job offers" 
ON public.job_offers FOR SELECT 
USING (
    -- 1. Tasker can view their own offers
    tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()) OR
    -- 2. Poster of the job can view all offers for it
    job_id IN (
        SELECT id FROM public.jobs 
        WHERE poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
    ) OR
    -- 3. Coworkers with accepted offers on the same job can view other accepted offers
    job_id IN (
        SELECT job_id FROM public.job_offers 
        WHERE status = 'accepted' 
          AND tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
    )
);
