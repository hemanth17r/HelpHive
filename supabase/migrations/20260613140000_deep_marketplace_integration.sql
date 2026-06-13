-- Phase 1, 2, 3: Deep Marketplace Integration

-- 1. Configuration Engine
CREATE TABLE IF NOT EXISTS public.marketplace_configurations (
    key VARCHAR PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default maturity thresholds
INSERT INTO public.marketplace_configurations (key, value) VALUES (
    'maturity_thresholds',
    '{"bootstrap_max": 5, "growth_max": 15}'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Insert active pool configuration
INSERT INTO public.marketplace_configurations (key, value) VALUES (
    'active_pool_rules',
    '{
      "growth_active_days": 7,
      "mature_active_hours": 24
    }'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Profiles Schema Updates (Category Coverage & Last Active)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS category_coverage JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- 3. Dynamic get_marketplace_stage
CREATE OR REPLACE FUNCTION public.get_marketplace_stage(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    v_supply INTEGER;
    v_bootstrap_max INTEGER;
    v_growth_max INTEGER;
    v_config JSONB;
BEGIN
    -- Pull configurations dynamically
    SELECT value INTO v_config FROM public.marketplace_configurations WHERE key = 'maturity_thresholds';
    v_bootstrap_max := COALESCE((v_config->>'bootstrap_max')::INTEGER, 5);
    v_growth_max := COALESCE((v_config->>'growth_max')::INTEGER, 15);

    v_supply := public.get_local_supply(p_category_id, p_lat, p_lng, p_radius_meters);
    
    IF v_supply <= v_bootstrap_max THEN
        RETURN 'bootstrap';
    ELSIF v_supply <= v_growth_max THEN
        RETURN 'growth';
    ELSE
        RETURN 'mature';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Deeply Integrated dispatch_job_wave
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
    -- 1. Get the job
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- 2. Get the matching behavior
    SELECT mb.* INTO v_behavior
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = v_job.skill_id;

    IF NOT FOUND THEN
        SELECT * INTO v_behavior WHERE name = 'on_location' LIMIT 1;
    END IF;

    -- 3. Determine location center
    IF v_behavior.location_strategy = 'primary_location' THEN
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    ELSIF v_behavior.location_strategy = 'secondary_location' THEN
        v_target_location := COALESCE(v_job.secondary_location, v_job.primary_location, v_job.location);
    ELSE
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    END IF;

    -- 4. Determine radius based on wave
    IF p_wave_number = 1 THEN v_radius_m := v_behavior.wave1_radius_m;
    ELSIF p_wave_number = 2 THEN v_radius_m := v_behavior.wave2_radius_m;
    ELSE v_radius_m := v_behavior.wave3_radius_m;
    END IF;

    -- 5. Pull Stage and Configurations
    v_stage := public.get_marketplace_stage(v_job.skill_id, ST_Y(v_target_location::geometry), ST_X(v_target_location::geometry), 20000);
    
    SELECT value INTO v_pool_config FROM public.marketplace_configurations WHERE key = 'active_pool_rules';
    v_growth_days := COALESCE((v_pool_config->>'growth_active_days')::INTEGER, 7);
    v_mature_hours := COALESCE((v_pool_config->>'mature_active_hours')::INTEGER, 24);

    -- 6. Find eligible taskers
    FOR v_tasker_record IN
        SELECT id, location, coverage_radius, category_coverage, is_online, last_active_at 
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
        -- Calculate category-specific tasker radius
        v_tasker_radius := COALESCE(
            (v_tasker_record.category_coverage->>v_job.skill_id)::INTEGER, 
            v_tasker_record.coverage_radius, 
            20000
        );

        -- Filter by tasker's defined service area
        IF v_behavior.location_strategy != 'remote' THEN
            -- Job must be within tasker's requested service area, AND tasker must be within wave radius
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Filter by Active Eligible Pool Stage Logic
        IF v_stage = 'growth' THEN
            -- Reasonably available (active within 7 days)
            IF v_tasker_record.last_active_at < (now() - (v_growth_days || ' days')::interval) THEN
                CONTINUE;
            END IF;
        ELSIF v_stage = 'mature' THEN
            -- Strict availability (online AND active recently)
            IF v_tasker_record.is_online = false OR v_tasker_record.last_active_at < (now() - (v_mature_hours || ' hours')::interval) THEN
                CONTINUE;
            END IF;
        END IF;
        -- If 'bootstrap', no availability filtering is applied (everyone passes)

        -- Offer the job
        INSERT INTO public.job_offers (
            job_id, tasker_id, status, amount_offered, wave_number, expires_at
        ) VALUES (
            p_job_id, v_tasker_record.id, 'pending', v_job.amount, p_wave_number, now() + interval '5 minutes'
        );
        v_offers_created := v_offers_created + 1;
        
        -- Cap at 10 offers per wave
        EXIT WHEN v_offers_created >= 10;
    END LOOP;

    RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to update last_active_at easily from frontend
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles
    SET last_active_at = now()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
