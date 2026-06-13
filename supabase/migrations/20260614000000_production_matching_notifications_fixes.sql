-- 20260614000000_production_matching_notifications_fixes.sql
-- Production-Grade Matching & Notifications Enhancements

-- 1. Add role column to notifications table if not exists
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT NULL;

-- 2. Redefine accept_job_offer to validate pending offer presence
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

    -- 3. Security Check: Validate that a pending offer actually exists for the calling tasker
    IF NOT EXISTS (
        SELECT 1 FROM public.job_offers 
        WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending'
    ) THEN
        RETURN FALSE; -- No pending offer for this tasker
    END IF;

    -- 4. Accept the job offer (V2 logic)
    UPDATE public.job_offers 
    SET status = 'accepted'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';

    -- 5. Expire all other pending offers
    UPDATE public.job_offers
    SET status = 'expired'
    WHERE job_id = p_job_id AND tasker_id != p_tasker_id AND status = 'pending';

    -- 6. Finalize assignment in jobs table
    UPDATE public.jobs
    SET tasker_id = p_tasker_id,
        status = 'accepted',
        v2_status = 'accepted'
    WHERE id = p_job_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine dispatch_job_wave to ignore the is_online availability check
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
        SELECT id, location, coverage_radius, last_active_at 
        FROM public.profiles
        WHERE role = 'tasker'
          AND v_job.skill_id = ANY(skills)
          AND id != v_job.poster_id  -- Secure: Exclude the poster themselves
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

        -- Filter by Active Eligible Pool Logic (Ignore is_online - taskers are always online)
        IF v_stage = 'growth' THEN
            IF v_tasker_record.last_active_at < (now() - (v_growth_days || ' days')::interval) THEN
                CONTINUE;
            END IF;
        ELSIF v_stage = 'mature' THEN
            IF v_tasker_record.last_active_at < (now() - (v_mature_hours || ' hours')::interval) THEN
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

-- 4. Enable Supabase Realtime for job_offers table safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'job_offers'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.job_offers;
    END IF;
  END IF;
END $$;

-- 5. Create Trigger function to send push notifications when a job offer is created
CREATE OR REPLACE FUNCTION public.on_job_offer_created()
RETURNS TRIGGER AS $$
DECLARE
    v_skill_id VARCHAR;
    v_amount NUMERIC;
    v_category_label VARCHAR;
    v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';
BEGIN
    -- Get job details
    SELECT skill_id, amount INTO v_skill_id, v_amount
    FROM public.jobs
    WHERE id = NEW.job_id;

    -- Human-readable category label mapping
    CASE v_skill_id
        WHEN 'errands' THEN v_category_label := 'Errands & Deliveries';
        WHEN 'personal_assistance' THEN v_category_label := 'Personal Assistance';
        WHEN 'moving' THEN v_category_label := 'Moving & Lifting';
        WHEN 'local_helpers' THEN v_category_label := 'Local Helpers';
        WHEN 'events' THEN v_category_label := 'Events & Staffing';
        WHEN 'creative' THEN v_category_label := 'Creative Services';
        ELSE v_category_label := 'Task';
    END CASE;

    -- Perform the HTTP POST request asynchronously using pg_net
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
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', v_apikey,
            'Authorization', 'Bearer ' || v_apikey
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Bind the trigger to job_offers
DROP TRIGGER IF EXISTS tr_job_offer_created ON public.job_offers;
CREATE TRIGGER tr_job_offer_created
AFTER INSERT ON public.job_offers
FOR EACH ROW
EXECUTE FUNCTION public.on_job_offer_created();
