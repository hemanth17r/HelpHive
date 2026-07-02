-- DROP old overloaded functions to start clean
DROP FUNCTION IF EXISTS public.commit_partial_crew(uuid);
DROP FUNCTION IF EXISTS public.commit_partial_crew(uuid, uuid);
DROP FUNCTION IF EXISTS public.verify_job_otp(uuid, character varying);
DROP FUNCTION IF EXISTS public.verify_job_otp(uuid, character varying, uuid);

-- 2. RE-DEFINE accept_job_offer
CREATE OR REPLACE FUNCTION public.accept_job_offer(p_job_id UUID, p_tasker_id UUID)
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

    -- 2. Validate job is still available
    IF v_job_status IN ('completed', 'cancelled') OR v_v2_status IN ('completed', 'cancelled') THEN
        RETURN FALSE;
    END IF;

    -- 3. Check if all slots are already filled
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    IF v_accepted_count >= v_people_needed THEN
        RETURN FALSE;
    END IF;

    -- 4. Security Check: Validate that a pending offer actually exists for the calling tasker
    IF NOT EXISTS (
        SELECT 1 FROM public.job_offers 
        WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending'
    ) THEN
        RETURN FALSE;
    END IF;

    -- 5. Accept the job offer
    UPDATE public.job_offers 
    SET status = 'accepted'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';

    -- 6. Recalculate accepted count
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    -- 7. If all slots are filled, close the job and expire remaining offers
    IF v_accepted_count >= v_people_needed THEN
        UPDATE public.job_offers
        SET status = 'expired'
        WHERE job_id = p_job_id AND status = 'pending';

        UPDATE public.jobs
        SET tasker_id = p_tasker_id, -- Keep last accepted tasker for legacy column compatibility
            status = 'accepted',
            v2_status = 'accepted'
        WHERE id = p_job_id;
    ELSE
        -- If more helpers are needed, keep job searching in DB
        UPDATE public.jobs
        SET tasker_id = p_tasker_id
        WHERE id = p_job_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-DEFINE decline_job_offer
CREATE OR REPLACE FUNCTION public.decline_job_offer(p_job_id UUID, p_tasker_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Authorization Check: Only restrict if auth.uid() is not null
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_tasker_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this profile.';
    END IF;

    UPDATE public.job_offers
    SET status = 'rejected'
    WHERE job_id = p_job_id AND tasker_id = p_tasker_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-DEFINE cancel_accepted_job_offer
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
        UPDATE public.jobs
        SET status = 'open',
            v2_status = 'searching',
            tasker_id = NULL
        WHERE id = p_job_id;
        
        -- Delete expired offers so they can be re-invited/matched
        DELETE FROM public.job_offers
        WHERE job_id = p_job_id AND status = 'expired';
    ELSE
        -- There are remaining accepted helpers
        IF v_job_status = 'in_progress' OR v_v2_status = 'in_progress' THEN
            -- Keep status as in_progress
            UPDATE public.jobs
            SET tasker_id = (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id AND status = 'accepted' LIMIT 1)
            WHERE id = p_job_id;
        ELSE
            -- Put the job back to searching / open to find a replacement for the cancelled slot
            UPDATE public.jobs
            SET status = 'open',
                v2_status = 'searching',
                tasker_id = (SELECT tasker_id FROM public.job_offers WHERE job_id = p_job_id AND status = 'accepted' LIMIT 1)
            WHERE id = p_job_id;

            -- Delete expired offers so they can be re-invited/matched
            DELETE FROM public.job_offers
            WHERE job_id = p_job_id AND status = 'expired';
        END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-DEFINE commit_partial_crew (2-Parameter Signature)
CREATE OR REPLACE FUNCTION public.commit_partial_crew(p_job_id UUID, p_poster_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_accepted_count INTEGER;
BEGIN
    -- Authorization Check: Caller must be the job poster
    IF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.jobs
            WHERE id = p_job_id
              AND poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only the job poster can commit the crew.';
        END IF;
    ELSE
        -- auth.uid() is null, check if the job exists and the poster matches p_poster_id
        IF NOT EXISTS (
            SELECT 1 FROM public.jobs
            WHERE id = p_job_id AND poster_id = p_poster_id
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Poster mismatch.';
        END IF;
    END IF;

    -- Count accepted taskers
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    IF v_accepted_count = 0 THEN
        RETURN FALSE;
    END IF;

    -- Update job to match current count and finalize acceptance
    UPDATE public.jobs
    SET people_needed = v_accepted_count,
        status = 'accepted',
        v2_status = 'accepted'
    WHERE id = p_job_id;

    -- Expire any remaining pending offers
    UPDATE public.job_offers
    SET status = 'expired'
    WHERE job_id = p_job_id AND status = 'pending';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RE-DEFINE commit_partial_crew (1-Parameter Legacy Signature)
CREATE OR REPLACE FUNCTION public.commit_partial_crew(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_poster_id UUID;
BEGIN
    -- Resolve poster profile ID from auth.uid()
    SELECT id INTO v_poster_id FROM public.profiles WHERE auth_id = auth.uid();
    
    -- Fallback to the job poster if auth.uid() is null
    IF v_poster_id IS NULL THEN
        SELECT poster_id INTO v_poster_id FROM public.jobs WHERE id = p_job_id;
    END IF;

    IF v_poster_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Poster not found.';
    END IF;

    RETURN public.commit_partial_crew(p_job_id, v_poster_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RE-DEFINE verify_job_otp (3-Parameter Signature)
CREATE OR REPLACE FUNCTION public.verify_job_otp(
  p_job_id uuid,
  p_otp character varying,
  p_tasker_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
  v_caller_profile_id uuid;
BEGIN
  -- Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  -- Ensure job exists
  IF v_job IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve caller's profile ID
  v_caller_profile_id := p_tasker_id;

  -- Security Check: Ensure the caller is an accepted tasker for this job
  IF NOT EXISTS (
    SELECT 1 FROM public.job_offers 
    WHERE job_id = p_job_id AND tasker_id = v_caller_profile_id AND status = 'accepted'
  ) THEN
    RETURN false;
  END IF;

  -- Verify OTP and atomically update the job status
  IF v_job.otp = p_otp THEN
    IF v_job.status IN ('active', 'accepted', 'open', 'searching', 'en_route_to_primary') 
       OR v_job.v2_status IN ('accepted', 'searching', 'en_route_to_primary') THEN
      UPDATE public.jobs 
      SET status = 'in_progress', 
          v2_status = 'in_progress'
      WHERE id = p_job_id;

      -- ALSO expire any other pending job offers so they don't remain pending forever
      UPDATE public.job_offers
      SET status = 'expired'
      WHERE job_id = p_job_id AND status = 'pending';
    END IF;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 8. RE-DEFINE verify_job_otp (2-Parameter Legacy Signature)
CREATE OR REPLACE FUNCTION public.verify_job_otp(
  p_job_id uuid,
  p_otp character varying
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_profile_id uuid;
BEGIN
  -- Resolve caller's profile ID from auth_id
  SELECT id INTO v_caller_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  
  -- Fallback to the tasker currently assigned to the job if auth.uid() is null
  IF v_caller_profile_id IS NULL THEN
    SELECT tasker_id INTO v_caller_profile_id FROM public.jobs WHERE id = p_job_id;
  END IF;

  IF v_caller_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Forward request to the primary 3-parameter function
  RETURN public.verify_job_otp(p_job_id, p_otp, v_caller_profile_id);
END;
$$;
