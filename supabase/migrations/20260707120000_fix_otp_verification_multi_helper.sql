-- Migration to fix OTP verification for multi-helper jobs when a crew member leaves
CREATE OR REPLACE FUNCTION public.verify_job_otp(
  p_job_id uuid,
  p_otp character varying,
  p_tasker_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
  v_caller_profile_id uuid;
  v_verified_count int;
  v_accepted_count int;
BEGIN
  -- Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  -- Ensure job exists
  IF v_job IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve caller's profile ID
  v_caller_profile_id := p_tasker_id;

  -- Fallback 1: Resolve from auth.uid() if not provided
  IF v_caller_profile_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT id INTO v_caller_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  END IF;

  -- Fallback 2: Fall back to the tasker currently assigned to the job if still null
  IF v_caller_profile_id IS NULL THEN
    SELECT tasker_id INTO v_caller_profile_id FROM public.jobs WHERE id = p_job_id;
  END IF;

  IF v_caller_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Security Check: Ensure the caller is an accepted tasker for this job
  IF NOT EXISTS (
    SELECT 1 FROM public.job_offers 
    WHERE job_id = p_job_id AND tasker_id = v_caller_profile_id AND status = 'accepted'
  ) THEN
    RETURN false;
  END IF;

  -- Verify OTP and atomically update the job status
  IF v_job.otp = p_otp THEN
    -- 1. Update the specific tasker's job offer to set otp_verified to true
    UPDATE public.job_offers
    SET otp_verified = true
    WHERE job_id = p_job_id AND tasker_id = v_caller_profile_id AND status = 'accepted';

    -- Count total verified helpers for this job
    SELECT count(*) INTO v_verified_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted' AND otp_verified = true;

    -- Count total accepted helpers for this job
    SELECT count(*) INTO v_accepted_count
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    -- 2. Update jobs table status to 'in_progress' ONLY if all needed slots have been verified
    IF v_verified_count >= COALESCE(v_accepted_count, 1) THEN
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
