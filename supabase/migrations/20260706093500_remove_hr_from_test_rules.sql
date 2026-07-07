-- 20260706093500_remove_hr_from_test_rules.sql
-- Remove HR from test routing rules, restoring it as a normal real production user account.

-- 1. Redefine dispatch_job_wave()
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
    
    -- Test routing parameters
    v_poster_name VARCHAR;
    v_is_test_job BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- Get poster name to check if it's a test/debug profile
    SELECT name INTO v_poster_name FROM public.profiles WHERE id = v_job.poster_id;

    -- Classify as test job if description contains [TEST]/[DEBUG], or if poster name contains tester/test/debug
    v_is_test_job := (
        COALESCE(v_job.description, '') ILIKE '%[TEST]%' 
        OR COALESCE(v_job.description, '') ILIKE '%[DEBUG]%'
        OR COALESCE(v_poster_name, '') ILIKE '%tester%'
        OR COALESCE(v_poster_name, '') ILIKE '%test%'
        OR COALESCE(v_poster_name, '') ILIKE '%debug%'
    );

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
      -- Safe test routing filter (HR excluded)
      AND (
          CASE 
              WHEN v_is_test_job THEN 
                  (p.name ILIKE '%tester%' OR p.name ILIKE '%test%' OR p.name ILIKE '%debug%')
              ELSE 
                  (p.name NOT ILIKE '%tester%' AND p.name NOT ILIKE '%test%' AND p.name NOT ILIKE '%debug%')
          END
      )
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
          -- Safe test routing filter (HR excluded)
          AND (
              CASE 
                  WHEN v_is_test_job THEN 
                      (p.name ILIKE '%tester%' OR p.name ILIKE '%test%' OR p.name ILIKE '%debug%')
                  ELSE 
                      (p.name NOT ILIKE '%tester%' AND p.name NOT ILIKE '%test%' AND p.name NOT ILIKE '%debug%')
              END
          )
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


-- 2. Redefine get_local_supply()
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
          -- Exclude test profiles (HR excluded)
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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
          -- Exclude test profiles (HR excluded)
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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
          -- Exclude test profiles (HR excluded)
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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
          -- Exclude test profiles (HR excluded)
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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
