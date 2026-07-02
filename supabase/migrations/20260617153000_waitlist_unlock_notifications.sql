-- Migration: Add trigger to notify waitlist hirers when a tasker becomes available in their area
-- Created: 2026-06-17

CREATE OR REPLACE FUNCTION public.notify_waitlist_on_supply_unlock()
RETURNS TRIGGER AS $$
DECLARE
    v_waitlist_record RECORD;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- Only run for active taskers with location and skills
    IF NEW.role != 'tasker' OR NEW.location IS NULL OR NEW.skills IS NULL OR array_length(NEW.skills, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find waitlist entries that match any of the tasker's skills and are within coverage
    FOR v_waitlist_record IN 
        SELECT id, poster_id, category_id
        FROM public.hirer_waitlists
        WHERE category_id = ANY(NEW.skills)
          AND ST_DWithin(NEW.location, location, COALESCE(NEW.coverage_radius, 20000))
    LOOP
        -- Human-readable category label mapping
        CASE v_waitlist_record.category_id
            WHEN 'errands' THEN v_category_label := 'Errands & Deliveries';
            WHEN 'personal_assistance' THEN v_category_label := 'Personal Assistance';
            WHEN 'moving' THEN v_category_label := 'Moving & Lifting';
            WHEN 'local_helpers' THEN v_category_label := 'Local Helpers';
            WHEN 'events' THEN v_category_label := 'Events & Staffing';
            WHEN 'creative' THEN v_category_label := 'Creative Services';
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

-- Bind the trigger to profiles table
DROP TRIGGER IF EXISTS tr_profile_updated_waitlist ON public.profiles;
CREATE TRIGGER tr_profile_updated_waitlist
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_waitlist_on_supply_unlock();
