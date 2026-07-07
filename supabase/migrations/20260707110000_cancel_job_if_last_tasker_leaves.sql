-- Migration to update cancel_accepted_job_offer:
-- 1. If the last tasker leaves an accepted/active job, transition the job to 'cancelled' immediately.
-- 2. If other taskers are still active, keep the job status active (do not revert to searching).
CREATE OR REPLACE FUNCTION public.cancel_accepted_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_job_status VARCHAR;
    v_v2_status public.job_status_enum;
    v_people_needed INTEGER;
    v_accepted_count INTEGER;
BEGIN
    -- Authorization Check: Only restrict if auth.uid() is not null
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_tasker_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this profile.';
    END IF;

    -- 1. Lock the job row for update to prevent concurrent race conditions
    SELECT status, v2_status, people_needed INTO v_job_status, v_v2_status, v_people_needed
    FROM public.jobs
    WHERE id = p_job_id
    FOR UPDATE;

    -- 2. Validate job status is active/accepted
    IF v_job_status IN ('completed', 'cancelled') OR v_v2_status IN ('completed', 'cancelled') THEN
        RETURN FALSE;
    END IF;

    -- 3. Check if this tasker actually has an accepted offer
    IF NOT EXISTS (
        SELECT 1 FROM public.job_offers 
        WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'accepted'
    ) THEN
        RETURN FALSE;
    END IF;

    -- 5. Set the offer status to 'rejected' to permanently exclude them
    UPDATE public.job_offers
    SET status = 'rejected'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'accepted';

    -- 6. Count how many accepted taskers are left
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    -- 7. Update the job status
    IF v_accepted_count = 0 THEN
        -- If no helpers left, cancel the task entirely
        UPDATE public.jobs
        SET status = 'cancelled',
            v2_status = 'cancelled',
            tasker_id = NULL
        WHERE id = p_job_id;
        
        -- Expire any pending offers
        UPDATE public.job_offers
        SET status = 'expired'
        WHERE job_id = p_job_id AND status = 'pending';
    ELSE
        -- There are remaining accepted helpers: keep the job status active
        UPDATE public.jobs
        SET tasker_id = (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id AND status = 'accepted' LIMIT 1)
        WHERE id = p_job_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
