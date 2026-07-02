-- Migration to add stage-aware matching logic to dispatch_job_wave

-- 1. Create get_marketplace_stage function
CREATE OR REPLACE FUNCTION public.get_marketplace_stage(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    v_supply INTEGER;
BEGIN
    v_supply := public.get_local_supply(p_category_id, p_lat, p_lng, p_radius_meters);
    
    IF v_supply <= 5 THEN
        RETURN 'bootstrap';
    ELSIF v_supply <= 15 THEN
        RETURN 'growth';
    ELSE
        RETURN 'mature';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update dispatch_job_wave to use stage-aware matching
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
BEGIN
    -- 1. Get the job
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- 2. Get the matching behavior via abstractions
    SELECT mb.* INTO v_behavior
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = v_job.skill_id;

    -- Fallback to a default if category missing
    IF NOT FOUND THEN
        SELECT * INTO v_behavior WHERE name = 'on_location' LIMIT 1;
    END IF;

    -- 3. Determine location center
    IF v_behavior.location_strategy = 'primary_location' THEN
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    ELSIF v_behavior.location_strategy = 'secondary_location' THEN
        v_target_location := COALESCE(v_job.secondary_location, v_job.primary_location, v_job.location);
    ELSE
        -- 'remote' or other
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    END IF;

    -- 4. Determine radius based on wave
    IF p_wave_number = 1 THEN v_radius_m := v_behavior.wave1_radius_m;
    ELSIF p_wave_number = 2 THEN v_radius_m := v_behavior.wave2_radius_m;
    ELSE v_radius_m := v_behavior.wave3_radius_m;
    END IF;

    -- Determine stage using a 20km radius (FLEXIBLE baseline)
    v_stage := public.get_marketplace_stage(v_job.skill_id, ST_Y(v_target_location::geometry), ST_X(v_target_location::geometry), 20000);

    -- 5. Find eligible taskers
    -- We filter by role, location, availability, apply a fairness sorting, and NOW respect marketplace stage
    FOR v_tasker_record IN
        SELECT id FROM public.profiles
        WHERE role = 'tasker'
          AND id != v_job.poster_id
          AND id NOT IN (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id)
          AND id NOT IN (
              SELECT tasker_id 
              FROM public.jobs 
              WHERE tasker_id IS NOT NULL 
                AND v2_status IN ('accepted', 'in_progress')
          )
          AND (v_behavior.location_strategy = 'remote' OR ST_DWithin(location, v_target_location, v_radius_m))
          -- Stage Aware Matching Logic
          AND (
              (v_stage = 'bootstrap') 
              OR 
              (v_stage IN ('growth', 'mature') AND is_online = true)
          )
        ORDER BY COALESCE(tasks_completed, 0) ASC -- Fairness: prioritize newer taskers
        LIMIT 10 -- Batch size per wave
    LOOP
        INSERT INTO public.job_offers (
            job_id, tasker_id, status, amount_offered, wave_number, expires_at
        ) VALUES (
            p_job_id, v_tasker_record.id, 'pending', v_job.amount, p_wave_number, now() + interval '5 minutes'
        );
        v_offers_created := v_offers_created + 1;
    END LOOP;

    RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
