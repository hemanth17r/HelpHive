-- MIGRATION: 20260629150000_matching_logic_clash_fixes.sql
-- Fixes key logic clashes between the skill matching, fallback wave matching, declines, accepts, and notifications.
-- Optimizes subqueries with NOT EXISTS for indexing and database performance under high load.

-- 1. Redefine accept_job_offer to allow taskers to accept fallback/walk-in jobs
CREATE OR REPLACE FUNCTION public.accept_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR;
    v_v2_status public.job_status_enum;
    v_people_needed INTEGER;
    v_accepted_count INTEGER;
    v_offer_status VARCHAR;
BEGIN
    -- Authorization Check: Only restrict if auth.uid() is not null
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
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

    -- 4. Check if an offer exists.
    -- If it does, it must be 'pending'. If it exists but is 'rejected' or 'expired', we deny acceptance.
    -- If it does not exist (e.g. walk-in / fallback accept from open local feeds), we allow it.
    SELECT status INTO v_offer_status
    FROM public.job_offers
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id;
    
    IF FOUND THEN
        IF v_offer_status != 'pending' THEN
            RETURN FALSE;
        END IF;
        
        -- Accept the existing offer
        UPDATE public.job_offers 
        SET status = 'accepted'
        WHERE job_id = p_job_id AND tasker_id = p_tasker_id;
    ELSE
        -- Insert a new accepted offer row
        INSERT INTO public.job_offers (job_id, tasker_id, status, wave_number, expires_at)
        VALUES (p_job_id, p_tasker_id, 'accepted', 0, now() + interval '1 year');
    END IF;

    -- 5. Recalculate accepted count
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    -- 6. If all slots are filled, close the job and expire remaining offers
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


-- 2. Redefine decline_job_offer to insert a 'rejected' row if no pending offer row existed
CREATE OR REPLACE FUNCTION public.decline_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Authorization Check: Only restrict if auth.uid() is not null
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_tasker_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this profile.';
    END IF;

    -- Try updating existing pending offer to 'rejected'
    UPDATE public.job_offers
    SET status = 'rejected'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';
    
    -- If no row was updated (walk-in/fallback decline), insert a rejected row to record the decline
    IF NOT FOUND THEN
        INSERT INTO public.job_offers (job_id, tasker_id, status, wave_number, expires_at)
        VALUES (p_job_id, p_tasker_id, 'rejected', 0, now() + interval '1 year')
        ON CONFLICT (job_id, tasker_id) DO UPDATE
        SET status = 'rejected';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Redefine dispatch_job_wave with optimized NOT EXISTS subqueries for indexing and fallback matching logic
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
          -- Prioritize exact category matches.
          -- Fall back to other local taskers if exact matches are fewer than required, OR if we are in Wave 2/3
          AND (
              (v_job.skill_id = ANY(p.skills))
              OR
              (v_exact_match_count < v_remaining_needed OR p_wave_number > 1)
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


-- 4. Redefine check_and_dispatch_waves_internal with category-aware fallback checks to prevent premature expiration
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
        SELECT id, created_at, scheduled_for, COALESCE(max_wave_dispatched, 0) as max_wave_dispatched, people_needed, skill_id, poster_id, location, primary_location 
        FROM public.jobs 
        WHERE v2_status = 'searching' 
          AND status = 'open'
    LOOP
        v_age := now() - v_job.created_at;

        -- 1. Expire jobs that are past scheduled time
        IF v_job.scheduled_for IS NOT NULL AND now() > v_job.scheduled_for THEN
            UPDATE public.jobs
            SET status = 'expired', v2_status = 'expired'
            WHERE id = v_job.id;
            
            UPDATE public.job_offers
            SET status = 'expired'
            WHERE job_id = v_job.id AND status = 'pending';
            
            CONTINUE;
        END IF;

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

        -- 2. Recycle Loop / DECLINE EXHAUSTION FIX
        IF v_job.max_wave_dispatched = 3 THEN
            SELECT count(*) INTO v_active_offers
            FROM public.job_offers
            WHERE job_id = v_job.id AND status = 'pending';
            
            IF v_active_offers = 0 THEN
                -- Resolve location and radii definitions to match dispatch rules
                SELECT mb.* INTO v_behavior
                FROM public.matching_behaviors mb
                JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
                JOIN public.job_categories jc ON jc.category_group_id = cg.id
                WHERE jc.id = v_job.skill_id;

                IF NOT FOUND THEN
                    SELECT * INTO v_behavior FROM public.matching_behaviors WHERE name = 'on_location' LIMIT 1;
                END IF;

                v_target_location := COALESCE(v_job.primary_location, v_job.location);
                v_radius_m := v_behavior.wave3_radius_m;

                -- Count exact category matching online taskers within the area who haven't rejected (using NOT EXISTS)
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
                  AND NOT EXISTS (
                      SELECT 1 
                      FROM public.job_offers jo 
                      WHERE jo.job_id = v_job.id AND jo.tasker_id = p.id AND jo.status = 'rejected'
                  )
                  AND (
                      v_behavior.location_strategy = 'remote'
                      OR (
                          ST_DWithin(v_target_location, p.location, COALESCE(p.coverage_radius, 5000))
                          AND ST_DWithin(v_target_location, p.location, v_radius_m)
                          AND ST_DWithin(v_target_location, p.location, 50000)
                      )
                  );

                -- Count matching online taskers who haven't rejected (including fallback matches if exact count is low)
                SELECT count(*) INTO v_eligible_taskers_count
                FROM public.profiles p
                WHERE p.role = 'tasker'
                  AND p.is_online = true
                  AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
                  AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
                  AND p.upi_id IS NOT NULL AND p.upi_id != ''
                  AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
                  AND p.location IS NOT NULL
                  AND (
                      (v_job.skill_id = ANY(p.skills))
                      OR
                      (v_exact_match_count < (v_job.people_needed - v_accepted_offers))
                  )
                  AND p.id != v_job.poster_id
                  AND NOT EXISTS (
                      SELECT 1 
                      FROM public.job_offers jo 
                      WHERE jo.job_id = v_job.id AND jo.tasker_id = p.id AND jo.status = 'rejected'
                  );

                -- If all matching and fallback taskers have explicitly declined, expire the job
                IF v_eligible_taskers_count = 0 THEN
                    UPDATE public.jobs
                    SET status = 'expired', v2_status = 'expired'
                    WHERE id = v_job.id;
                    
                    DELETE FROM public.job_offers
                    WHERE job_id = v_job.id AND status = 'expired';
                    
                    CONTINUE;
                END IF;

                -- Delete ONLY expired offers, leaving 'rejected' offers to permanently exclude those taskers
                DELETE FROM public.job_offers WHERE job_id = v_job.id AND status = 'expired';
                
                -- Reset wave counter to trigger fresh Wave 1 matching
                UPDATE public.jobs SET max_wave_dispatched = 0, created_at = now() WHERE id = v_job.id;
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


-- 5. Redefine on_job_offer_created notification trigger to customize message and context by skill match
CREATE OR REPLACE FUNCTION public.on_job_offer_created()
RETURNS TRIGGER AS $$
DECLARE
    v_skill_id VARCHAR;
    v_amount NUMERIC;
    v_category_label VARCHAR;
    v_tasker_skills VARCHAR[];
    v_is_skill_match BOOLEAN := FALSE;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    SELECT skill_id, amount INTO v_skill_id, v_amount FROM public.jobs WHERE id = NEW.job_id;
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

    IF v_is_skill_match THEN
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', NEW.tasker_id,
                'title', 'New ' || v_category_label || ' Offer!',
                'body', 'You have a new task request for ₹' || COALESCE(NEW.amount_offered, v_amount) || '. Accept now before it expires!',
                'action_url', 'tasker_home',
                'type', 'new_job_offer',
                'role', 'tasker'
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
                'body', 'A new ' || v_category_label || ' task for ₹' || COALESCE(NEW.amount_offered, v_amount) || ' is available nearby. Tap to view and accept!',
                'action_url', 'tasker_home',
                'type', 'new_job_offer',
                'role', 'tasker'
            ),
            headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey, 'Authorization', 'Bearer ' || v_apikey)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Redefine get_local_supply with optimized NOT EXISTS subqueries and strict onboarding completeness checks
CREATE OR REPLACE FUNCTION public.get_local_supply(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_specific_count INTEGER;
    v_general_count INTEGER;
    v_target_location GEOGRAPHY(POINT);
    v_location_strategy VARCHAR;
BEGIN
    v_target_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    SELECT mb.location_strategy INTO v_location_strategy
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = p_category_id;

    IF COALESCE(v_location_strategy, 'on_location') = 'remote' THEN
        -- Remote specific category match count
        SELECT count(*) INTO v_specific_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND p_category_id = ANY(skills)
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );

        -- Remote general active tasker count (any skills)
        SELECT count(*) INTO v_general_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );
    ELSE
        -- Physical specific category match count
        SELECT count(*) INTO v_specific_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND p_category_id = ANY(skills)
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters))
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );

        -- Physical general active tasker count (any skills)
        SELECT count(*) INTO v_general_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters))
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );
    END IF;

    -- Return supply count based on two conditions:
    -- 1. At least 1 tasker matching the category
    -- 2. OR at least 2 taskers in the area overall
    IF v_specific_count >= 1 THEN
        RETURN v_specific_count;
    ELSIF v_general_count >= 2 THEN
        RETURN v_general_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

