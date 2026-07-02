-- Phase 1.4: Matching Engine V2 Foundation

-- 1. Matching Behaviors
-- Defines how a job should behave during matching (location logic and wave radii)
CREATE TABLE IF NOT EXISTS public.matching_behaviors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    location_strategy VARCHAR(50) NOT NULL, -- e.g., 'primary_location', 'secondary_location', 'remote'
    wave1_radius_m INTEGER NOT NULL DEFAULT 5000,
    wave2_radius_m INTEGER NOT NULL DEFAULT 15000,
    wave3_radius_m INTEGER NOT NULL DEFAULT 5000000, -- 5000km (pan-India)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Category Groups
-- Abstracts specific categories into high-level groups that map to a behavior
CREATE TABLE IF NOT EXISTS public.category_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    matching_behavior_id UUID REFERENCES public.matching_behaviors(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Job Categories Mapping
-- Maps frontend string skill_ids (e.g. 'moving') to their logical category group
CREATE TABLE IF NOT EXISTS public.job_categories (
    id VARCHAR(50) PRIMARY KEY,
    category_group_id UUID REFERENCES public.category_groups(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Initial Data
DO $$
DECLARE
    v_ptp_id UUID;
    v_onloc_id UUID;
    v_remote_id UUID;
    
    v_group_logistics UUID;
    v_group_services UUID;
    v_group_digital UUID;
BEGIN
    -- Behaviors
    INSERT INTO public.matching_behaviors (name, location_strategy, wave1_radius_m, wave2_radius_m, wave3_radius_m)
    VALUES ('point_to_point', 'primary_location', 5000, 15000, 5000000)
    ON CONFLICT (name) DO UPDATE SET location_strategy = EXCLUDED.location_strategy RETURNING id INTO v_ptp_id;

    INSERT INTO public.matching_behaviors (name, location_strategy, wave1_radius_m, wave2_radius_m, wave3_radius_m)
    VALUES ('on_location', 'primary_location', 5000, 15000, 5000000)
    ON CONFLICT (name) DO UPDATE SET location_strategy = EXCLUDED.location_strategy RETURNING id INTO v_onloc_id;

    INSERT INTO public.matching_behaviors (name, location_strategy, wave1_radius_m, wave2_radius_m, wave3_radius_m)
    VALUES ('remote', 'remote', 5000000, 5000000, 5000000)
    ON CONFLICT (name) DO UPDATE SET location_strategy = EXCLUDED.location_strategy RETURNING id INTO v_remote_id;

    -- Groups
    INSERT INTO public.category_groups (name, matching_behavior_id)
    VALUES ('Logistics & Transport', v_ptp_id)
    ON CONFLICT (name) DO UPDATE SET matching_behavior_id = EXCLUDED.matching_behavior_id RETURNING id INTO v_group_logistics;

    INSERT INTO public.category_groups (name, matching_behavior_id)
    VALUES ('On-site Services', v_onloc_id)
    ON CONFLICT (name) DO UPDATE SET matching_behavior_id = EXCLUDED.matching_behavior_id RETURNING id INTO v_group_services;

    INSERT INTO public.category_groups (name, matching_behavior_id)
    VALUES ('Digital & Remote', v_remote_id)
    ON CONFLICT (name) DO UPDATE SET matching_behavior_id = EXCLUDED.matching_behavior_id RETURNING id INTO v_group_digital;

    -- Mapping existing skill_ids
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('moving', v_group_logistics) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('travel', v_group_logistics) ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('errands', v_group_services) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('events', v_group_services) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('photography', v_group_services) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('others', v_group_services) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.job_categories (id, category_group_id) VALUES ('academic_help', v_group_digital) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.job_categories (id, category_group_id) VALUES ('tech_help', v_group_digital) ON CONFLICT (id) DO NOTHING;

END $$;

-- 4. Dispatch Job Wave Function
CREATE OR REPLACE FUNCTION public.dispatch_job_wave(p_job_id UUID, p_wave_number INT)
RETURNS INTEGER AS $$
DECLARE
    v_job RECORD;
    v_behavior RECORD;
    v_target_location GEOGRAPHY(POINT);
    v_radius_m INTEGER;
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

    -- 5. Find eligible taskers
    -- We filter by role, location, and apply a fairness sorting
    FOR v_tasker_record IN
        SELECT id FROM public.profiles
        WHERE role = 'tasker'
          AND id != v_job.poster_id
          AND id NOT IN (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id)
          AND (v_behavior.location_strategy = 'remote' OR ST_DWithin(location, v_target_location, v_radius_m))
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

-- 5. Acceptance Locking Function
CREATE OR REPLACE FUNCTION public.accept_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR; -- Legacy status
    v_v2_status public.job_status_enum;
BEGIN
    -- 1. Lock the job row for update to prevent concurrent race conditions
    SELECT status, v2_status INTO v_job_status, v_v2_status
    FROM public.jobs
    WHERE id = p_job_id
    FOR UPDATE;

    -- 2. Validate job is still available
    IF v_job_status IN ('accepted', 'completed', 'cancelled') OR v_v2_status IN ('accepted', 'in_progress', 'completed', 'cancelled') THEN
        RETURN FALSE; -- Job already taken or no longer available
    END IF;

    -- 3. Accept the job offer if one exists (V2 logic)
    UPDATE public.job_offers 
    SET status = 'accepted'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';

    -- 4. Expire all other pending offers
    UPDATE public.job_offers
    SET status = 'expired'
    WHERE job_id = p_job_id AND tasker_id != p_tasker_id AND status = 'pending';

    -- 5. Finalize assignment in jobs table
    UPDATE public.jobs
    SET tasker_id = p_tasker_id,
        status = 'accepted',
        v2_status = 'accepted'
    WHERE id = p_job_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
