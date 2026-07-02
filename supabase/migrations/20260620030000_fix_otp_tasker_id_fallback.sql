-- Migration: Fix verify_job_otp fallback for NULL p_tasker_id and update status check constraint
-- Target: Supabase database public schema
-- Scope: Update verify_job_otp(uuid, character varying, uuid) to fall back when tasker ID is NULL,
-- and alter the jobs status check constraint to permit 'in_progress'.

-- 1. Alter check constraint on public.jobs to allow 'in_progress' status
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status = ANY (ARRAY['open'::text, 'accepted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));

-- 2. Redefine verify_job_otp function
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
