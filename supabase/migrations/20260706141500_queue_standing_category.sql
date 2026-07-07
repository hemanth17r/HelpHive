-- Supabase Migration: Seed Queue Standing & Update Trigger Categories Mapping
-- Created: 2026-07-06

-- 1. Seed queue_standing in job_categories under the 'Services & Staffing' behavior group
INSERT INTO public.job_categories (id, category_group_id)
VALUES (
    'queue_standing', 
    (SELECT id FROM public.category_groups WHERE name = 'Services & Staffing' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- 2. Redefine notify_waitlist_on_supply_unlock trigger function with updated category labels
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_supply_unlock()
RETURNS TRIGGER AS $$
DECLARE
    v_waitlist_record RECORD;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- Optimize trigger execution: exit early if this is an update but online status, location, skills, and coverage_radius did not change
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.is_online = NEW.is_online) AND (OLD.location = NEW.location) AND (OLD.skills = NEW.skills) AND (COALESCE(OLD.coverage_radius, 0) = COALESCE(NEW.coverage_radius, 0)) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Only run for online active taskers with location and skills
    IF NEW.role != 'tasker' OR NEW.is_online != true OR NEW.location IS NULL OR NEW.skills IS NULL OR array_length(NEW.skills, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find waitlist entries that match any of the tasker's skills and are within range (using spatial index)
    FOR v_waitlist_record IN 
        SELECT hw.id, hw.poster_id, hw.category_id, hw.location, mb.location_strategy
        FROM public.hirer_waitlists hw
        LEFT JOIN public.job_categories jc ON jc.id = hw.category_id
        LEFT JOIN public.category_groups cg ON cg.id = jc.category_group_id
        LEFT JOIN public.matching_behaviors mb ON mb.id = cg.matching_behavior_id
        WHERE hw.category_id = ANY(NEW.skills)
          AND (
            (COALESCE(mb.location_strategy, 'on_location') = 'remote' AND ST_DWithin(NEW.location, hw.location, 5000000))
            OR
            (COALESCE(mb.location_strategy, 'on_location') != 'remote' AND ST_DWithin(NEW.location, hw.location, COALESCE(NEW.coverage_radius, 20000)))
          )
    LOOP
        -- Human-readable category label mapping for all 13 categories (including split queue_standing)
        CASE v_waitlist_record.category_id
            WHEN 'errands' THEN v_category_label := 'Local Deliveries';
            WHEN 'personal_assistance' THEN v_category_label := 'Companion Help';
            WHEN 'queue_standing' THEN v_category_label := 'Queue Standing & Waiting';
            WHEN 'moving' THEN v_category_label := 'Shift & Load';
            WHEN 'local_helpers' THEN v_category_label := 'Household Help';
            WHEN 'events' THEN v_category_label := 'Event Helpers';
            WHEN 'creative' THEN v_category_label := 'Vlog Cameraman';
            WHEN 'others_physical' THEN v_category_label := 'Custom On-Site Help';
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

-- 3. Redefine on_job_offer_created trigger function with updated category labels
CREATE OR REPLACE FUNCTION public.on_job_offer_created()
RETURNS TRIGGER AS $$
DECLARE
    v_skill_id VARCHAR;
    v_amount NUMERIC;
    v_category_label VARCHAR;
    v_tasker_skills VARCHAR[];
    v_is_skill_match BOOLEAN := FALSE;
    v_address_id UUID;
    v_formatted_address TEXT;
    v_landmark VARCHAR;
    v_location_str TEXT := '';
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    SELECT skill_id, amount, primary_address_id INTO v_skill_id, v_amount, v_address_id FROM public.jobs WHERE id = NEW.job_id;
    SELECT skills INTO v_tasker_skills FROM public.profiles WHERE id = NEW.tasker_id;
    
    IF v_skill_id = ANY(v_tasker_skills) THEN
        v_is_skill_match := TRUE;
    END IF;

    CASE v_skill_id
        WHEN 'errands' THEN v_category_label := 'Local Deliveries';
        WHEN 'personal_assistance' THEN v_category_label := 'Companion Help';
        WHEN 'queue_standing' THEN v_category_label := 'Queue Standing & Waiting';
        WHEN 'moving' THEN v_category_label := 'Shift & Load';
        WHEN 'local_helpers' THEN v_category_label := 'Household Help';
        WHEN 'events' THEN v_category_label := 'Event Helpers';
        WHEN 'creative' THEN v_category_label := 'Vlog Cameraman';
        WHEN 'others_physical' THEN v_category_label := 'Custom On-Site Help';
        WHEN 'video_editing' THEN v_category_label := 'Video Editing';
        WHEN 'graphic_design' THEN v_category_label := 'Graphic Design';
        WHEN 'writing_translation' THEN v_category_label := 'Writing & Translation';
        WHEN 'tech_support' THEN v_category_label := 'Tech & Website Support';
        WHEN 'others_remote' THEN v_category_label := 'Remote Task';
        ELSE v_category_label := 'Task';
    END CASE;

    -- Determine location details
    IF v_skill_id IN ('video_editing', 'graphic_design', 'writing_translation', 'tech_support', 'others_remote') THEN
        v_location_str := ' (Remote)';
    ELSIF v_address_id IS NOT NULL THEN
        SELECT formatted_address, landmark INTO v_formatted_address, v_landmark 
        FROM public.user_addresses 
        WHERE id = v_address_id;
        
        IF v_landmark IS NOT NULL AND v_landmark <> '' THEN
            v_location_str := ' near ' || v_landmark;
        ELSIF v_formatted_address IS NOT NULL AND v_formatted_address <> '' THEN
            v_location_str := ' near ' || split_part(v_formatted_address, ',', 1);
            IF length(trim(v_location_str)) < 10 THEN
                v_location_str := ' near ' || substring(v_formatted_address from 1 for 30);
            END IF;
        END IF;
    END IF;

    IF v_is_skill_match THEN
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', NEW.tasker_id,
                'title', 'New ' || v_category_label || ' Offer!',
                'body', 'You have a new task request for ₹' || COALESCE(NEW.amount_offered, v_amount) || COALESCE(v_location_str, '') || '. Accept now before it expires!',
                'action_url', 'tasker_home',
                'type', 'new_job_offer',
                'role', 'tasker',
                'metadata', jsonb_build_object('job_id', NEW.job_id)
            ),
            headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey, 'Authorization', 'Bearer ' || v_apikey)
        );
    ELSE
        -- Fallback local area task notification
        PERFORM net.http_post(
            url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
            body := jsonb_build_object(
                'user_id', NEW.tasker_id,
                'title', 'New ' || v_category_label || ' Available!',
                'body', 'A new ' || v_category_label || ' is available nearby' || COALESCE(v_location_str, '') || ' for ₹' || COALESCE(NEW.amount_offered, v_amount) || '. Open the app to view and request!',
                'action_url', 'tasker_home',
                'type', 'new_job_available',
                'role', 'tasker',
                'metadata', jsonb_build_object('job_id', NEW.job_id)
            ),
            headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey, 'Authorization', 'Bearer ' || v_apikey)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
