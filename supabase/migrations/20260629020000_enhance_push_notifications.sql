-- Redefine on_job_offer_created to include location details (physical landmark/address or Remote status) in push notifications
CREATE OR REPLACE FUNCTION public.on_job_offer_created()
RETURNS TRIGGER AS $$
DECLARE
    v_skill_id VARCHAR;
    v_amount NUMERIC;
    v_category_label VARCHAR;
    v_address_id UUID;
    v_formatted_address TEXT;
    v_landmark VARCHAR;
    v_location_str TEXT := '';
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- 1. Fetch job details
    SELECT skill_id, amount, primary_address_id INTO v_skill_id, v_amount, v_address_id 
    FROM public.jobs 
    WHERE id = NEW.job_id;

    -- 2. Determine human-readable category label
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

    -- 3. Determine location context (Remote vs Physical Location)
    IF v_skill_id IN ('video_editing', 'graphic_design', 'writing_translation', 'tech_support', 'others_remote') THEN
        v_location_str := ' (Remote)';
    ELSIF v_address_id IS NOT NULL THEN
        SELECT formatted_address, landmark INTO v_formatted_address, v_landmark 
        FROM public.user_addresses 
        WHERE id = v_address_id;
        
        IF v_landmark IS NOT NULL AND v_landmark <> '' THEN
            v_location_str := ' near ' || v_landmark;
        ELSIF v_formatted_address IS NOT NULL AND v_formatted_address <> '' THEN
            -- Extract first segment before comma
            v_location_str := ' near ' || split_part(v_formatted_address, ',', 1);
            -- Fallback if the segment is too short to be descriptive
            IF length(trim(v_location_str)) < 10 THEN
                v_location_str := ' near ' || substring(v_formatted_address from 1 for 30);
            END IF;
        END IF;
    END IF;

    -- 4. Send notification via Edge Function
    PERFORM net.http_post(
        url := 'https://yylquyddiipqkpxjjdkz.supabase.co/functions/v1/push-notification',
        body := jsonb_build_object(
            'user_id', NEW.tasker_id,
            'title', 'New ' || v_category_label || ' Offer!',
            'body', 'You have a new task request for ₹' || COALESCE(NEW.amount_offered, v_amount) || COALESCE(v_location_str, '') || '. Accept now before it expires!',
            'action_url', 'tasker_home',
            'type', 'new_job_offer',
            'role', 'tasker'
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey, 'Authorization', 'Bearer ' || v_apikey)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
