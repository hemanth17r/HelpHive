-- Standardize Coverage Radii & Remove Tech Category

-- 1. Remove tech_help and academic_help from job_categories
DELETE FROM public.job_categories WHERE id IN ('tech_help', 'academic_help');

-- 2. Remove Digital & Remote group and remote matching behavior
DELETE FROM public.category_groups WHERE name = 'Digital & Remote';
DELETE FROM public.matching_behaviors WHERE name = 'remote';

-- 3. Insert creative explicitly under On-site Services category group
DO $$
DECLARE
    v_group_services UUID;
BEGIN
    SELECT id INTO v_group_services FROM public.category_groups WHERE name = 'On-site Services';
    IF v_group_services IS NOT NULL THEN
        INSERT INTO public.job_categories (id, category_group_id)
        VALUES ('creative', v_group_services)
        ON CONFLICT (id) DO UPDATE SET category_group_id = EXCLUDED.category_group_id;
    END IF;
END $$;

-- 4. Update point_to_point and on_location matching behaviors to wave radii of 5km, 10km, 20km
UPDATE public.matching_behaviors
SET wave1_radius_m = 5000,
    wave2_radius_m = 10000,
    wave3_radius_m = 20000
WHERE name IN ('point_to_point', 'on_location');

-- 5. Redefine dispatch_job_wave to rely on profile-wide coverage_radius
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
    
    -- Configs
    v_pool_config JSONB;
    v_growth_days INTEGER;
    v_mature_hours INTEGER;
    
    v_tasker_radius INTEGER;
BEGIN
    -- Get the job
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- Get the matching behavior
    SELECT mb.* INTO v_behavior
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = v_job.skill_id;

    IF NOT FOUND THEN
        SELECT * INTO v_behavior FROM public.matching_behaviors WHERE name = 'on_location' LIMIT 1;
    END IF;

    -- Determine location center
    IF v_behavior.location_strategy = 'primary_location' THEN
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    ELSIF v_behavior.location_strategy = 'secondary_location' THEN
        v_target_location := COALESCE(v_job.secondary_location, v_job.primary_location, v_job.location);
    ELSE
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    END IF;

    -- Determine radius based on wave
    IF p_wave_number = 1 THEN v_radius_m := v_behavior.wave1_radius_m;
    ELSIF p_wave_number = 2 THEN v_radius_m := v_behavior.wave2_radius_m;
    ELSE v_radius_m := v_behavior.wave3_radius_m;
    END IF;

    -- Pull Stage and Configurations
    v_stage := public.get_marketplace_stage(v_job.skill_id, ST_Y(v_target_location::geometry), ST_X(v_target_location::geometry), 20000);
    
    SELECT value INTO v_pool_config FROM public.marketplace_configurations WHERE key = 'active_pool_rules';
    v_growth_days := COALESCE((v_pool_config->>'growth_active_days')::INTEGER, 7);
    v_mature_hours := COALESCE((v_pool_config->>'mature_active_hours')::INTEGER, 24);

    -- Find eligible taskers
    FOR v_tasker_record IN
        SELECT id, location, coverage_radius, is_online, last_active_at 
        FROM public.profiles
        WHERE role = 'tasker'
          AND v_job.skill_id = ANY(skills)
          AND id != v_job.poster_id
          AND id NOT IN (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id)
          AND id NOT IN (
              SELECT tasker_id 
              FROM public.jobs 
              WHERE tasker_id IS NOT NULL 
                AND v2_status IN ('accepted', 'in_progress')
          )
    LOOP
        -- Calculate tasker radius
        v_tasker_radius := COALESCE(v_tasker_record.coverage_radius, 5000);

        -- Filter by tasker's defined service area
        IF v_behavior.location_strategy != 'remote' THEN
            -- Job must be within tasker's requested service area, AND tasker must be within wave radius
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Filter by Active Eligible Pool Logic
        IF v_stage = 'growth' THEN
            IF v_tasker_record.last_active_at < (now() - (v_growth_days || ' days')::interval) THEN
                CONTINUE;
            END IF;
        ELSIF v_stage = 'mature' THEN
            IF v_tasker_record.is_online = false OR v_tasker_record.last_active_at < (now() - (v_mature_hours || ' hours')::interval) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Offer the job
        INSERT INTO public.job_offers (
            job_id, tasker_id, status, amount_offered, wave_number, expires_at
        ) VALUES (
            p_job_id, v_tasker_record.id, 'pending', v_job.amount, p_wave_number, now() + interval '5 minutes'
        );
        v_offers_created := v_offers_created + 1;
        
        EXIT WHEN v_offers_created >= 10;
    END LOOP;

    -- Atomically update max_wave_dispatched on the job
    UPDATE public.jobs 
    SET max_wave_dispatched = p_wave_number 
    WHERE id = p_job_id;

    RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Synchronize job categories with constants.js definitions
DO $$
DECLARE
    v_group_services UUID;
BEGIN
    SELECT id INTO v_group_services FROM public.category_groups WHERE name = 'On-site Services';
    IF v_group_services IS NOT NULL THEN
        INSERT INTO public.job_categories (id, category_group_id)
        VALUES 
            ('personal_assistance', v_group_services),
            ('local_helpers', v_group_services)
        ON CONFLICT (id) DO UPDATE SET category_group_id = EXCLUDED.category_group_id;
    END IF;
    
    -- Delete legacy unused categories
    DELETE FROM public.job_categories WHERE id IN ('travel', 'photography');
END $$;

