-- Phase 1.5: Hyperlocal Tuning & Lifecycle Simplification

-- Replace the dispatch_job_wave function with category-specific hyperlocal logic
CREATE OR REPLACE FUNCTION public.dispatch_job_wave(p_job_id UUID, p_wave_number INT)
RETURNS INTEGER AS $$
DECLARE
    v_job RECORD;
    v_target_location GEOGRAPHY(POINT);
    v_radius_m INTEGER;
    v_tasker_record RECORD;
    v_offers_created INTEGER := 0;
    v_is_remote BOOLEAN := FALSE;
BEGIN
    -- 1. Get the job
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- 2. Determine target location
    v_target_location := COALESCE(v_job.primary_location, v_job.location);

    -- 3. Determine radius and remote status based on category (skill_id) and wave
    IF v_job.skill_id = 'errands' THEN
        IF p_wave_number = 1 THEN v_radius_m := 1000;
        ELSIF p_wave_number = 2 THEN v_radius_m := 3000;
        ELSE v_radius_m := 5000; END IF;
    ELSIF v_job.skill_id = 'personal_assistance' THEN
        IF p_wave_number = 1 THEN v_radius_m := 2000;
        ELSIF p_wave_number = 2 THEN v_radius_m := 5000;
        ELSE v_radius_m := 10000; END IF;
    ELSIF v_job.skill_id = 'moving' THEN
        IF p_wave_number = 1 THEN v_radius_m := 2000;
        ELSIF p_wave_number = 2 THEN v_radius_m := 5000;
        ELSE v_radius_m := 8000; END IF;
    ELSIF v_job.skill_id = 'local_helpers' THEN
        IF p_wave_number = 1 THEN v_radius_m := 2000;
        ELSIF p_wave_number = 2 THEN v_radius_m := 5000;
        ELSE v_radius_m := 10000; END IF;
    ELSIF v_job.skill_id = 'events' THEN
        IF p_wave_number = 1 THEN v_radius_m := 5000;
        ELSIF p_wave_number = 2 THEN v_radius_m := 15000;
        ELSE v_radius_m := 30000; END IF;
    ELSIF v_job.skill_id IN ('tech_help', 'creative', 'academic_help') THEN
        v_is_remote := TRUE;
    ELSE
        -- Generic fallback
        IF p_wave_number = 1 THEN v_radius_m := 2000;
        ELSIF p_wave_number = 2 THEN v_radius_m := 5000;
        ELSE v_radius_m := 10000; END IF;
    END IF;

    -- 4. Find eligible taskers
    FOR v_tasker_record IN
        SELECT id FROM public.profiles
        WHERE role = 'tasker'
          AND id != v_job.poster_id
          AND id NOT IN (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id)
          AND (v_is_remote OR ST_DWithin(location, v_target_location, v_radius_m))
        ORDER BY COALESCE(tasks_completed, 0) ASC
        LIMIT 10
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
