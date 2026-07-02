-- decline_job_offer function
CREATE OR REPLACE FUNCTION public.decline_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.job_offers
    SET status = 'rejected'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- commit_partial_crew function for poster compromise
CREATE OR REPLACE FUNCTION public.commit_partial_crew(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_accepted_count INTEGER;
BEGIN
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


-- Redefine accept_job_offer to support multiple helpers
CREATE OR REPLACE FUNCTION public.accept_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR;
    v_v2_status public.job_status_enum;
    v_people_needed INTEGER;
    v_accepted_count INTEGER;
BEGIN
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


-- Create cancel_accepted_job_offer function for tasker cancellation
CREATE OR REPLACE FUNCTION public.cancel_accepted_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR;
    v_v2_status public.job_status_enum;
    v_people_needed INTEGER;
    v_accepted_count INTEGER;
BEGIN
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


-- Redefine dispatch_job_wave for stage-aware sequential queueing, stage-specific expirations, and replacement matching
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
        SELECT id, location, coverage_radius, last_active_at 
        FROM public.profiles
        WHERE role = 'tasker'
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


-- Updated Wave Evaluator with Recycle Logic and Auto-Expiration
CREATE OR REPLACE FUNCTION public.check_and_dispatch_waves_internal()
RETURNS void AS $$
DECLARE
    v_job RECORD;
    v_age INTERVAL;
    v_active_offers INTEGER;
    v_accepted_offers INTEGER;
BEGIN
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

        -- 3. Wave 2 dispatch & top-up: age >= 15 seconds, and max_wave_dispatched = 1
        IF v_age >= interval '15 seconds' AND v_job.max_wave_dispatched = 1 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 2);
        END IF;
        
        -- 4. Wave 3 dispatch & top-up: age >= 30 seconds, and max_wave_dispatched = 2
        IF v_age >= interval '30 seconds' AND v_job.max_wave_dispatched = 2 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 3);
        END IF;

        -- 5. Replacement Matching: If a slot becomes vacant (due to reject/expire) before fully matched
        IF v_job.max_wave_dispatched > 0 THEN
            PERFORM public.dispatch_job_wave(v_job.id, v_job.max_wave_dispatched);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Add security policy to allow posters to view job offers for their jobs
DROP POLICY IF EXISTS "Posters can view offers for their own jobs" ON public.job_offers;
CREATE POLICY "Posters can view offers for their own jobs" 
ON public.job_offers FOR SELECT 
USING (job_id IN (
    SELECT id FROM public.jobs 
    WHERE poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
));
