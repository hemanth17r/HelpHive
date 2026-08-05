-- MIGRATION: 20260804010000_tune_mature_stage_multiplier.sql
-- Description: Updates the Mature stage multiplier from 2 to 3 target active offers per wave per helper needed.

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

    -- Unified 90-second offer expiration window across all marketplace stages
    v_expires_interval := interval '90 seconds';

    -- Define target active offers based on stage and remaining helpers needed
    IF v_stage = 'bootstrap' THEN
        v_target_active := 10 * p_wave_number * v_remaining_needed;
    ELSIF v_stage = 'growth' THEN
        v_target_active := 5 * p_wave_number * v_remaining_needed;
    ELSE
        -- Mature stage multiplier tuned to 3 for optimal city response rates
        v_target_active := 3 * p_wave_number * v_remaining_needed;
    END IF;

    -- Count active pending offers for this job
    SELECT count(*) INTO v_active_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'pending';

    v_needed_offers := v_target_active - v_active_offers;
    IF v_needed_offers <= 0 THEN
        RETURN 0;
    END IF;

    -- Count online exact category matches within range for this wave
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
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id AND jo.status IN ('pending', 'accepted', 'rejected'))
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

    -- Find and loop through eligible taskers
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
          AND (
              (v_job.skill_id = ANY(p.skills))
              OR
              (p_wave_number > 1)
          )
          AND p.id != v_job.poster_id
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id AND jo.status IN ('pending', 'accepted', 'rejected'))
          AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
        ORDER BY 
          (v_job.skill_id = ANY(p.skills)) DESC,
          p.location <-> v_target_location
    LOOP
        v_tasker_radius := COALESCE(v_tasker_record.coverage_radius, 5000);

        -- Spatial range check
        IF v_behavior.location_strategy != 'remote' THEN
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, 50000) THEN
                CONTINUE;
            END IF;
        ELSE
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
