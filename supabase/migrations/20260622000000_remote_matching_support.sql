-- HelpHive Remote Matching & Category Reorganization Migration
-- Date: 2026-06-22

-- 1. Re-insert remote matching behavior
INSERT INTO public.matching_behaviors (name, location_strategy, wave1_radius_m, wave2_radius_m, wave3_radius_m)
VALUES ('remote', 'remote', 5000, 25000, 5000000)
ON CONFLICT (name) DO UPDATE SET
    location_strategy = EXCLUDED.location_strategy,
    wave1_radius_m = EXCLUDED.wave1_radius_m,
    wave2_radius_m = EXCLUDED.wave2_radius_m,
    wave3_radius_m = EXCLUDED.wave3_radius_m;

-- 2. Re-create category group
INSERT INTO public.category_groups (name, matching_behavior_id)
VALUES ('Digital & Remote', (SELECT id FROM public.matching_behaviors WHERE name = 'remote'))
ON CONFLICT (name) DO NOTHING;

-- 3. Register new categories and map them to groups
DO $$
DECLARE
    v_group_services UUID;
    v_group_digital UUID;
BEGIN
    SELECT id INTO v_group_services FROM public.category_groups WHERE name = 'On-site Services';
    SELECT id INTO v_group_digital FROM public.category_groups WHERE name = 'Digital & Remote';

    -- Physical Others (replaces generic 'others')
    INSERT INTO public.job_categories (id, category_group_id)
    VALUES ('others_physical', v_group_services)
    ON CONFLICT (id) DO NOTHING;

    -- Remote Categories
    INSERT INTO public.job_categories (id, category_group_id)
    VALUES 
        ('video_editing', v_group_digital),
        ('graphic_design', v_group_digital),
        ('writing_translation', v_group_digital),
        ('tech_support', v_group_digital),
        ('others_remote', v_group_digital)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- 4. Profile & Job Skill Migrations (Automatic Remap)
-- Map old 'creative' skill to new 'graphic_design' and 'video_editing'
UPDATE public.profiles
SET skills = array_replace(skills, 'creative', 'graphic_design')
WHERE 'creative' = ANY(skills);

-- Keep the physical 'creative' skill (Cameraman & Vlog Shooting) for these taskers as well
UPDATE public.profiles
SET skills = array_append(skills, 'creative')
WHERE 'graphic_design' = ANY(skills) AND NOT ('creative' = ANY(skills));

-- Add 'video_editing' for these creative taskers too
UPDATE public.profiles
SET skills = array_append(skills, 'video_editing')
WHERE 'graphic_design' = ANY(skills) AND NOT ('video_editing' = ANY(skills));

-- Map old 'others' skill to new 'others_physical' and 'others_remote'
UPDATE public.profiles
SET skills = array_replace(skills, 'others', 'others_physical')
WHERE 'others' = ANY(skills);

-- Add 'others_remote' for these general taskers
UPDATE public.profiles
SET skills = array_append(skills, 'others_remote')
WHERE 'others_physical' = ANY(skills) AND NOT ('others_remote' = ANY(skills));

-- Update existing jobs (temporarily disabling trigger to bypass skill_id update restriction)
ALTER TABLE public.jobs DISABLE TRIGGER USER;
UPDATE public.jobs SET skill_id = 'graphic_design' WHERE skill_id = 'creative';
UPDATE public.jobs SET skill_id = 'others_physical' WHERE skill_id = 'others';
ALTER TABLE public.jobs ENABLE TRIGGER USER;

-- 5. Redefine dispatch_job_wave to handle remote strategy (ignoring tasker radius & 50km cap)
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
        SELECT id, location, coverage_radius, last_active_at, is_online 
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
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

-- 6. Redefine check_and_dispatch_waves_internal with ghost matching & decline exhaustion fixes
CREATE OR REPLACE FUNCTION public.check_and_dispatch_waves_internal()
RETURNS void AS $$
DECLARE
    v_job RECORD;
    v_age INTERVAL;
    v_active_offers INTEGER;
    v_accepted_offers INTEGER;
    v_eligible_taskers_count INTEGER;
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
        SELECT id, created_at, scheduled_for, COALESCE(max_wave_dispatched, 0) as max_wave_dispatched, people_needed, skill_id, poster_id 
        FROM public.jobs 
        WHERE v2_status = 'searching' 
          AND status = 'open'
    LOOP
        v_age := now() - v_job.created_at;

        -- 1. GHOST MATCHING BUG FIX: Expire jobs that are past scheduled time
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
                -- Count matching online taskers who haven't rejected this job
                SELECT count(*) INTO v_eligible_taskers_count
                FROM public.profiles p
                WHERE p.role = 'tasker'
                  AND p.is_online = true
                  AND v_job.skill_id = ANY(p.skills)
                  AND p.id != v_job.poster_id
                  AND p.id NOT IN (
                      SELECT tasker_id 
                      FROM public.job_offers 
                      WHERE job_id = v_job.id AND status = 'rejected'
                  );

                -- If all matching taskers have explicitly declined, expire the job
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

-- 7. Redefine on_job_offer_created Notification trigger function
CREATE OR REPLACE FUNCTION public.on_job_offer_created()
RETURNS TRIGGER AS $$
DECLARE
    v_skill_id VARCHAR;
    v_amount NUMERIC;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    SELECT skill_id, amount INTO v_skill_id, v_amount FROM public.jobs WHERE id = NEW.job_id;

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Send announcement notification to all registered taskers about the category restructuring
INSERT INTO public.notifications (user_id, type, title, body, action_url, role)
SELECT id, 'announcement', '🚨 New Services: Remote & Cameraman!', 'We have introduced Online Remote categories (Video Editing, Design, Writing, Tech Support) and a physical Vlog Cameraman service. Update your profile skills in the Profile section to get matched for these new opportunities!', 'my_profile', 'tasker'
FROM public.profiles
WHERE role = 'tasker'
ON CONFLICT DO NOTHING;
