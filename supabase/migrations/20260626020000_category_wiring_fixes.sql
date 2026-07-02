-- HelpHive Category Wiring & Backend Range Matching Fixes
-- Date: 2026-06-26

-- 1. Redefine get_local_supply to align with dispatch_job_wave for remote categories
-- It preserves location checks via p_radius_meters (expanding wave) but ignores taskers' physical coverage_radius if the category is remote.
CREATE OR REPLACE FUNCTION public.get_local_supply(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
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
        -- Remote: Must fall within the active wave radius (p_radius_meters), but ignores tasker's physical coverage_radius
        SELECT count(*) INTO v_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND p_category_id = ANY(skills)
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND id NOT IN (
              SELECT tasker_id 
              FROM public.jobs 
              WHERE tasker_id IS NOT NULL 
                AND v2_status IN ('accepted', 'in_progress')
          );
    ELSE
        -- Physical: Must fall within wave radius AND tasker's coverage_radius
        SELECT count(*) INTO v_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND p_category_id = ANY(skills)
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters))
          AND id NOT IN (
              SELECT tasker_id 
              FROM public.jobs 
              WHERE tasker_id IS NOT NULL 
                AND v2_status IN ('accepted', 'in_progress')
          );
    END IF;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Redefine notify_waitlist_on_supply_unlock trigger function
-- Update category label cases for all 12 categories, and align range checks for remote waitlists (checking distance up to 5,000km).
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_supply_unlock()
RETURNS TRIGGER AS $$
DECLARE
    v_waitlist_record RECORD;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- Optimize trigger execution: exit early if this is an update but online status, location, and skills did not change
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.is_online = NEW.is_online) AND (OLD.location = NEW.location) AND (OLD.skills = NEW.skills) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Only run for online active taskers with location and skills
    IF NEW.role != 'tasker' OR NEW.is_online != true OR NEW.location IS NULL OR NEW.skills IS NULL OR array_length(NEW.skills, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find waitlist entries that match any of the tasker's skills and are within range
    FOR v_waitlist_record IN 
        SELECT hw.id, hw.poster_id, hw.category_id, hw.location, mb.location_strategy
        FROM public.hirer_waitlists hw
        LEFT JOIN public.job_categories jc ON jc.id = hw.category_id
        LEFT JOIN public.category_groups cg ON cg.id = jc.category_group_id
        LEFT JOIN public.matching_behaviors mb ON mb.id = cg.matching_behavior_id
        WHERE hw.category_id = ANY(NEW.skills)
    LOOP
        -- Spatial check: remote strategy checks up to 5,000km wave boundary, physical checks tasker physical coverage radius
        IF COALESCE(v_waitlist_record.location_strategy, 'on_location') = 'remote' THEN
            IF NOT ST_DWithin(NEW.location, v_waitlist_record.location, 5000000) THEN
                CONTINUE;
            END IF;
        ELSE
            IF NOT ST_DWithin(NEW.location, v_waitlist_record.location, COALESCE(NEW.coverage_radius, 20000)) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Human-readable category label mapping for all 12 categories
        CASE v_waitlist_record.category_id
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

        -- Send push notification via edge function
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', v_waitlist_record.poster_id,
                'title', v_category_label || ' unlocked!',
                'body', 'Good news! A tasker is now available for ' || v_category_label || ' in your area. Post your job today!',
                'action_url', 'post_job',
                'type', 'waitlist_unlock',
                'role', 'poster'
            ),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', v_apikey,
                'Authorization', 'Bearer ' || v_apikey
            )
        );

        -- Delete from waitlist to prevent duplicate notifications
        DELETE FROM public.hirer_waitlists WHERE id = v_waitlist_record.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
