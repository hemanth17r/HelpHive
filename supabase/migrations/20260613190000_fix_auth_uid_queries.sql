-- 20260613190000_fix_auth_uid_queries.sql
-- Fix database functions that incorrectly compared profile.id (random UUID) to auth.uid() (auth user ID)

-- 1. Redefine verify_job_otp
CREATE OR REPLACE FUNCTION public.verify_job_otp(p_job_id uuid, p_otp character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_job record;
BEGIN
  -- Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  -- Ensure job exists
  IF v_job IS NULL THEN
    RETURN false;
  END IF;

  -- Security: Ensure the caller is the assigned tasker
  -- (v_job.tasker_id refers to profiles.id; auth.uid() refers to profiles.auth_id)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_job.tasker_id AND auth_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  -- Verify OTP and atomically update the job status
  IF v_job.otp = p_otp THEN
    -- Only update if it hasn't been started yet
    IF v_job.status = 'active' OR v_job.status = 'accepted' THEN
      UPDATE public.jobs 
      SET status = 'in_progress', 
          v2_status = 'in_progress',
          started_at = now() 
      WHERE id = p_job_id;
    END IF;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$function$;

-- 2. Redefine update_last_active
CREATE OR REPLACE FUNCTION public.update_last_active()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.profiles
    SET last_active_at = now()
    WHERE auth_id = auth.uid();
END;
$function$;
