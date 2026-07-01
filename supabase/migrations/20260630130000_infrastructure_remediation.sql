-- Migration: 20260630130000_infrastructure_remediation.sql
-- Optimizes PL/pgSQL matching, waitlist triggers, and OTP verification workflows, and fixes RLS security leaks.

-- Add search_cycle_count column to jobs table if not exists
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS search_cycle_count INTEGER DEFAULT 0;

-- 1. Fix user_addresses SELECT policy data leak
DROP POLICY IF EXISTS "Addresses of jobs are viewable" ON public.user_addresses;

CREATE POLICY "Addresses of jobs are viewable"
ON public.user_addresses FOR SELECT
USING (
  -- 1. Owner of the address
  user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  -- 2. Poster of the job referencing this address
  OR id IN (
    SELECT primary_address_id FROM public.jobs 
    WHERE poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  )
  OR id IN (
    SELECT secondary_address_id FROM public.jobs 
    WHERE poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  )
  -- 3. Assigned tasker of the job referencing this address
  OR id IN (
    SELECT primary_address_id FROM public.jobs 
    WHERE tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  )
  OR id IN (
    SELECT secondary_address_id FROM public.jobs 
    WHERE tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  )
  -- 4. Candidate taskers with active job offers for the referencing job
  OR id IN (
    SELECT primary_address_id FROM public.jobs j
    JOIN public.job_offers o ON o.job_id = j.id
    WHERE o.tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  )
  OR id IN (
    SELECT secondary_address_id FROM public.jobs j
    JOIN public.job_offers o ON o.job_id = j.id
    WHERE o.tasker_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  )
);


-- 2. Redefine notify_waitlist_on_supply_unlock trigger function to resolve GIST index bypass
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_supply_unlock()
RETURNS TRIGGER AS $$
DECLARE
    v_waitlist_record RECORD;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- Optimize trigger execution: exit early if this is an update but online status, location, skills, and coverage_radius did not change
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.is_online = NEW.is_online) AND (OLD.location = NEW.location) AND (OLD.skills = NEW.skills) AND (COALESCE(OLD.coverage_radius, 0) = COALESCE(NEW.coverage_radius, 0)) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Only run for online active taskers with location and skills
    IF NEW.role != 'tasker' OR NEW.is_online != true OR NEW.location IS NULL OR NEW.skills IS NULL OR array_length(NEW.skills, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find waitlist entries that match any of the tasker's skills and are within range (using spatial index)
    FOR v_waitlist_record IN 
        SELECT hw.id, hw.poster_id, hw.category_id, hw.location, mb.location_strategy
        FROM public.hirer_waitlists hw
        LEFT JOIN public.job_categories jc ON jc.id = hw.category_id
        LEFT JOIN public.category_groups cg ON cg.id = jc.category_group_id
        LEFT JOIN public.matching_behaviors mb ON mb.id = cg.matching_behavior_id
        WHERE hw.category_id = ANY(NEW.skills)
          AND (
            (COALESCE(mb.location_strategy, 'on_location') = 'remote' AND ST_DWithin(NEW.location, hw.location, 5000000))
            OR
            (COALESCE(mb.location_strategy, 'on_location') != 'remote' AND ST_DWithin(NEW.location, hw.location, COALESCE(NEW.coverage_radius, 20000)))
          )
    LOOP
        -- Human-readable category label mapping for all 12 categories
        CASE v_waitlist_record.category_id
            WHEN 'errands' THEN v_category_label := 'Errands & Deliveries';
            WHEN 'personal_assistance' THEN v_category_label := 'Personal Assistance';
            WHEN 'moving' THEN v_category_label := 'Moving & Lifting';
            WHEN 'local_helpers' THEN v_category_label := 'Local Helpers';
            WHEN 'events' THEN v_category_label := 'Events & Staffing';
            WHEN 'creative' THEN v_category_label := 'Cameraman & Vlog Shooting';
            WHEN 'others_physical' THEN v_category_label := 'Local Task';
            WHEN 'video_editing' THEN v_category_label := 'Video Editing';
            WHEN 'graphic_design' THEN v_category_label := 'Graphic Design';
            WHEN 'writing_translation' THEN v_category_label := 'Writing & Translation';
            WHEN 'tech_support' THEN v_category_label := 'Tech & Website Support';
            WHEN 'others_remote' THEN v_category_label := 'Remote Task';
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


-- 3. Redefine dispatch_job_wave to resolve GiST spatial index bypass
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
    
    -- Fallback matching parameters
    v_exact_match_count INTEGER := 0;
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
        v_target_active := 10 * p_wave_number * v_remaining_needed; -- Low traffic: Broadcast
        v_expires_interval := interval '10 minutes';
    ELSIF v_stage = 'growth' THEN
        v_target_active := 5 * p_wave_number * v_remaining_needed;  -- Medium traffic
        v_expires_interval := interval '5 minutes';
    ELSE
        v_target_active := 2 * p_wave_number * v_remaining_needed;  -- Mature/High traffic
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

    -- Count online exact category matches within range for this wave (using fast index-friendly NOT EXISTS)
    SELECT count(*) INTO v_exact_match_count
    FROM public.profiles p
    WHERE p.role = 'tasker'
      AND p.is_online = true
      AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
      AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
      AND p.upi_id IS NOT NULL AND p.upi_id != ''
      AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
      AND p.location IS NOT NULL
      AND v_job.skill_id = ANY(p.skills)
      AND p.id != v_job.poster_id
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
      AND (
          v_behavior.location_strategy = 'remote'
          OR (
              ST_DWithin(v_target_location, p.location, COALESCE(p.coverage_radius, 5000))
              AND ST_DWithin(v_target_location, p.location, v_radius_m)
              AND ST_DWithin(v_target_location, p.location, 50000)
          )
      );

    -- Find and loop through eligible taskers (Prioritizing exact category matches, falling back to local area)
    FOR v_tasker_record IN
        SELECT p.id, p.location, p.coverage_radius, p.last_active_at, p.is_online 
        FROM public.profiles p
        WHERE p.role = 'tasker'
          AND p.is_online = true
          AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
          AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
          AND p.upi_id IS NOT NULL AND p.upi_id != ''
          AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
          AND p.location IS NOT NULL
          -- Force spatial filter using GiST index before sorting
          AND (
              v_behavior.location_strategy = 'remote'
              OR ST_DWithin(v_target_location, p.location, 50000)
          )
          -- Prioritize exact category matches in Wave 1.
          -- Fall back to other local taskers only if we are in Wave 2/3
          AND (
              (v_job.skill_id = ANY(p.skills))
              OR
              (p_wave_number > 1)
          )
          AND p.id != v_job.poster_id
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
        ORDER BY 
          (v_job.skill_id = ANY(p.skills)) DESC, -- Exact category matches first!
          p.location <-> v_target_location       -- KNN Distance Sort (closest first)
    LOOP
        v_tasker_radius := COALESCE(v_tasker_record.coverage_radius, 5000);

        -- Spatial range check
        IF v_behavior.location_strategy != 'remote' THEN
            -- Physical: Must be within tasker radius AND within wave radius AND capped at 50km
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, 50000) THEN
                CONTINUE;
            END IF;
        ELSE
            -- Remote: Bypasses tasker radius check, but must still fall within the active wave radius
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) THEN
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


-- 4. Redefine check_and_dispatch_waves_internal to fix the infinite recycle loop spatial omission
CREATE OR REPLACE FUNCTION public.check_and_dispatch_waves_internal()
RETURNS void AS $$
DECLARE
    v_job RECORD;
    v_age INTERVAL;
    v_active_offers INTEGER;
    v_accepted_offers INTEGER;
    v_eligible_taskers_count INTEGER;
    v_behavior RECORD;
    v_target_location GEOGRAPHY(POINT);
    v_exact_match_count INTEGER;
    v_radius_m INTEGER;
BEGIN
    -- advisory lock to prevent overlapping runs from cron ticks
    IF NOT pg_try_advisory_xact_lock(9876543) THEN
        RETURN;
    END IF;

    -- Clean up: Expire all pending offers whose expires_at has passed
    UPDATE public.job_offers
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();

    FOR v_job IN 
        SELECT id, created_at, scheduled_for, COALESCE(max_wave_dispatched, 0) as max_wave_dispatched, people_needed, skill_id, poster_id, location, primary_location, COALESCE(search_cycle_count, 0) as search_cycle_count
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
            UPDATE public.jobs 
            SET status = 'accepted', 
                v2_status = 'accepted' 
            WHERE id = v_job.id;

            UPDATE public.job_offers 
            SET status = 'expired' 
            WHERE job_id = v_job.id AND status = 'pending';
            
            CONTINUE;
        END IF;

        -- 2. Recycle Loop / DECLINE EXHAUSTION FIX (with spatial checking)
        IF v_job.max_wave_dispatched = 3 THEN
            SELECT count(*) INTO v_active_offers
            FROM public.job_offers
            WHERE job_id = v_job.id AND status = 'pending';
            
            IF v_active_offers = 0 THEN
                -- If we have completed 3 full sets (Set 1: 0, Set 2: 1, Set 3: 2), expire the job and notify the poster
                IF COALESCE(v_job.search_cycle_count, 0) >= 2 THEN
                    UPDATE public.jobs
                    SET status = 'expired', v2_status = 'expired'
                    WHERE id = v_job.id;
                    
                    UPDATE public.job_offers
                    SET status = 'expired'
                    WHERE job_id = v_job.id AND status = 'pending';

                    -- Send push notification to the poster
                    PERFORM net.http_post(
                        url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
                        body := jsonb_build_object(
                            'user_id', v_job.poster_id,
                            'title', 'No helpers found',
                            'body', 'We couldn''t find a helper for your request in time. Please try posting again!',
                            'action_url', 'job_history',
                            'type', 'job_expired',
                            'role', 'poster'
                        ),
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'apikey', v_apikey,
                            'Authorization', 'Bearer ' || v_apikey
                        )
                    );
                    
                    CONTINUE;
                END IF;

                -- Delete ONLY expired offers, leaving 'rejected' offers to permanently exclude those taskers
                DELETE FROM public.job_offers WHERE job_id = v_job.id AND status = 'expired';
                
                -- Increment cycle counter and reset wave counter to trigger fresh Wave 1 matching
                UPDATE public.jobs 
                SET max_wave_dispatched = 0, 
                    search_cycle_count = COALESCE(search_cycle_count, 0) + 1, 
                    created_at = now() 
                WHERE id = v_job.id;
                
                CONTINUE;
            END IF;
        END IF;
        
        -- Wave 1 dispatch & top-up
        IF v_job.max_wave_dispatched = 0 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 1);
        END IF;

        -- Wave 2 dispatch: age >= 1 minute
        IF v_age >= interval '1 minute' AND v_job.max_wave_dispatched = 1 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 2);
        END IF;
        
        -- Wave 3 dispatch: age >= 2 minutes
        IF v_age >= interval '2 minutes' AND v_job.max_wave_dispatched = 2 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 3);
        END IF;

        -- Replacement Matching
        IF v_job.max_wave_dispatched > 0 THEN
            PERFORM public.dispatch_job_wave(v_job.id, v_job.max_wave_dispatched);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Redefine verify_job_otp to support multi-helper OTP verification
CREATE OR REPLACE FUNCTION public.verify_job_otp(
  p_job_id uuid,
  p_otp character varying,
  p_tasker_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
  v_caller_profile_id uuid;
  v_verified_count int;
BEGIN
  -- Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  -- Ensure job exists
  IF v_job IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve caller's profile ID
  v_caller_profile_id := p_tasker_id;

  -- Fallback 1: Resolve from auth.uid() if not provided
  IF v_caller_profile_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT id INTO v_caller_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  END IF;

  -- Fallback 2: Fall back to the tasker currently assigned to the job if still null
  IF v_caller_profile_id IS NULL THEN
    SELECT tasker_id INTO v_caller_profile_id FROM public.jobs WHERE id = p_job_id;
  END IF;

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
    -- 1. Update the specific tasker's job offer to set otp_verified to true
    UPDATE public.job_offers
    SET otp_verified = true
    WHERE job_id = p_job_id AND tasker_id = v_caller_profile_id AND status = 'accepted';

    -- Count total verified helpers for this job
    SELECT count(*) INTO v_verified_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted' AND otp_verified = true;

    -- 2. Update jobs table status to 'in_progress' ONLY if all needed slots have been verified
    IF v_verified_count >= COALESCE(v_job.people_needed, 1) THEN
      UPDATE public.jobs 
      SET status = 'in_progress', 
          v2_status = 'in_progress'
      WHERE id = p_job_id;

      -- ALSO expire any other pending job offers so they don't remain pending forever
      UPDATE public.job_offers
      SET status = 'expired'
      WHERE job_id = p_job_id AND status = 'pending';
    END IF;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;


-- 6. Redefine on_job_offer_created to restore the location-aware push notification template
CREATE OR REPLACE FUNCTION public.on_job_offer_created()
RETURNS TRIGGER AS $$
DECLARE
    v_skill_id VARCHAR;
    v_amount NUMERIC;
    v_category_label VARCHAR;
    v_tasker_skills VARCHAR[];
    v_is_skill_match BOOLEAN := FALSE;
    v_address_id UUID;
    v_formatted_address TEXT;
    v_landmark VARCHAR;
    v_location_str TEXT := '';
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    SELECT skill_id, amount, primary_address_id INTO v_skill_id, v_amount, v_address_id FROM public.jobs WHERE id = NEW.job_id;
    SELECT skills INTO v_tasker_skills FROM public.profiles WHERE id = NEW.tasker_id;
    
    IF v_skill_id = ANY(v_tasker_skills) THEN
        v_is_skill_match := TRUE;
    END IF;

    CASE v_skill_id
        WHEN 'errands' THEN v_category_label := 'Errands & Deliveries';
        WHEN 'personal_assistance' THEN v_category_label := 'Personal Assistance';
        WHEN 'moving' THEN v_category_label := 'Moving & Lifting';
        WHEN 'local_helpers' THEN v_category_label := 'Local Helpers';
        WHEN 'events' THEN v_category_label := 'Events & Staffing';
        WHEN 'creative' THEN v_category_label := 'Cameraman & Vlog Shooting';
        WHEN 'others_physical' THEN v_category_label := 'Local Task';
        WHEN 'video_editing' THEN v_category_label := 'Video Editing';
        WHEN 'graphic_design' THEN v_category_label := 'Graphic Design';
        WHEN 'writing_translation' THEN v_category_label := 'Writing & Translation';
        WHEN 'tech_support' THEN v_category_label := 'Tech & Website Support';
        WHEN 'others_remote' THEN v_category_label := 'Remote Task';
        ELSE v_category_label := 'Task';
    END CASE;

    -- Determine location details
    IF v_skill_id IN ('video_editing', 'graphic_design', 'writing_translation', 'tech_support', 'others_remote') THEN
        v_location_str := ' (Remote)';
    ELSIF v_address_id IS NOT NULL THEN
        SELECT formatted_address, landmark INTO v_formatted_address, v_landmark 
        FROM public.user_addresses 
        WHERE id = v_address_id;
        
        IF v_landmark IS NOT NULL AND v_landmark <> '' THEN
            v_location_str := ' near ' || v_landmark;
        ELSIF v_formatted_address IS NOT NULL AND v_formatted_address <> '' THEN
            v_location_str := ' near ' || split_part(v_formatted_address, ',', 1);
            IF length(trim(v_location_str)) < 10 THEN
                v_location_str := ' near ' || substring(v_formatted_address from 1 for 30);
            END IF;
        END IF;
    END IF;

    IF v_is_skill_match THEN
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', NEW.tasker_id,
                'title', 'New ' || v_category_label || ' Offer!',
                'body', 'You have a new task request for ₹' || COALESCE(NEW.amount_offered, v_amount) || COALESCE(v_location_str, '') || '. Accept now before it expires!',
                'action_url', 'tasker_home',
                'type', 'new_job_offer',
                'role', 'tasker',
                'metadata', jsonb_build_object('job_id', NEW.job_id)
            ),
            headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey, 'Authorization', 'Bearer ' || v_apikey)
        );
    ELSE
        -- Fallback local area task notification
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', NEW.tasker_id,
                'title', 'New Task in Your Area!',
                'body', 'A new ' || v_category_label || ' task for ₹' || COALESCE(NEW.amount_offered, v_amount) || COALESCE(v_location_str, '') || ' is available nearby. Tap to view!',
                'action_url', 'tasker_home',
                'type', 'new_job_offer',
                'role', 'tasker',
                'metadata', jsonb_build_object('job_id', NEW.job_id)
            ),
            headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey, 'Authorization', 'Bearer ' || v_apikey)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Add foreign key and city indexes for user_addresses and profiles
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_user_addresses_city ON public.user_addresses(city);
CREATE INDEX IF NOT EXISTS idx_jobs_primary_address_id ON public.jobs(primary_address_id);
CREATE INDEX IF NOT EXISTS idx_jobs_secondary_address_id ON public.jobs(secondary_address_id);
