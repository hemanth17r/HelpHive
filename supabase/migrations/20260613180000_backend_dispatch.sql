-- 1. Add max_wave_dispatched column to jobs table (defaulting to 0)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS max_wave_dispatched INTEGER DEFAULT 0;

-- 2. Backfill existing active/searching jobs to wave 3 so they aren't processed again
UPDATE public.jobs 
SET max_wave_dispatched = 3 
WHERE status != 'open' OR v2_status != 'searching';

-- 3. Redefine dispatch_job_wave to update max_wave_dispatched atomically
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
        SELECT * INTO v_behavior WHERE name = 'on_location' LIMIT 1;
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

-- 4. Create internal check function to evaluate age and dispatch waves
CREATE OR REPLACE FUNCTION public.check_and_dispatch_waves_internal()
RETURNS void AS $$
DECLARE
    v_job RECORD;
    v_age INTERVAL;
BEGIN
    FOR v_job IN 
        SELECT id, created_at, COALESCE(max_wave_dispatched, 0) as max_wave_dispatched 
        FROM public.jobs 
        WHERE v2_status = 'searching' 
          AND status = 'open'
          AND COALESCE(max_wave_dispatched, 0) < 3
    LOOP
        v_age := now() - v_job.created_at;
        
        -- Wave 1 recovery: if somehow Wave 1 was never dispatched
        IF v_job.max_wave_dispatched = 0 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 1);
        END IF;

        -- Wave 2 dispatch: age >= 15 seconds, and max_wave_dispatched = 1
        IF v_age >= interval '15 seconds' AND v_job.max_wave_dispatched = 1 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 2);
        END IF;
        
        -- Wave 3 dispatch: age >= 30 seconds, and max_wave_dispatched = 2
        v_age := now() - v_job.created_at; -- re-evaluate in case Wave 2 changed timing
        IF v_age >= interval '30 seconds' AND v_job.max_wave_dispatched = 2 THEN
            PERFORM public.dispatch_job_wave(v_job.id, 3);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the wrapper function to run multiple sleep cycles per pg_cron minute execution
CREATE OR REPLACE FUNCTION public.auto_dispatch_job_waves()
RETURNS void AS $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        PERFORM public.check_and_dispatch_waves_internal();
        IF i < 4 THEN
            PERFORM pg_sleep(15);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Schedule cron job in Supabase pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-dispatch-job-waves') THEN
      PERFORM cron.unschedule('auto-dispatch-job-waves');
    END IF;
  END IF;
END $$;

SELECT cron.schedule(
  'auto-dispatch-job-waves',
  '* * * * *',
  $$ SELECT public.auto_dispatch_job_waves(); $$
);
