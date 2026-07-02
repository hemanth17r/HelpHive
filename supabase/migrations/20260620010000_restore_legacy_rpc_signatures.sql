-- Drop existing overloaded functions to ensure a clean slate
DROP FUNCTION IF EXISTS public.verify_job_otp(uuid, character varying);
DROP FUNCTION IF EXISTS public.verify_job_otp(uuid, character varying, uuid);
DROP FUNCTION IF EXISTS public.submit_user_rating(uuid, text, uuid, integer, text);
DROP FUNCTION IF EXISTS public.submit_user_rating(uuid, text, uuid, integer, text, uuid);
DROP FUNCTION IF EXISTS public.submit_user_report(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.submit_user_report(uuid, uuid, text, text, uuid);

-- 1. VERIFY_JOB_OTP (3-Parameter Signature)
CREATE OR REPLACE FUNCTION public.verify_job_otp(
  p_job_id uuid,
  p_otp character varying,
  p_tasker_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    END IF;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$function$;

-- 2. VERIFY_JOB_OTP (2-Parameter Legacy Signature)
CREATE OR REPLACE FUNCTION public.verify_job_otp(
  p_job_id uuid,
  p_otp character varying
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_caller_profile_id uuid;
BEGIN
  -- Resolve caller's profile ID from auth_id
  SELECT id INTO v_caller_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  
  -- If we can't find the profile via auth_id (e.g. custom auth/local storage on some clients),
  -- fall back to the tasker currently assigned to the job to ensure they aren't blocked.
  IF v_caller_profile_id IS NULL THEN
    SELECT tasker_id INTO v_caller_profile_id FROM public.jobs WHERE id = p_job_id;
  END IF;

  IF v_caller_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Forward request to the primary 3-parameter function
  RETURN public.verify_job_otp(p_job_id, p_otp, v_caller_profile_id);
END;
$function$;


-- 3. SUBMIT_USER_RATING (6-Parameter Signature)
CREATE OR REPLACE FUNCTION public.submit_user_rating(
  p_job_id UUID,
  p_giver_role TEXT, -- 'poster' or 'tasker'
  p_receiver_profile_id UUID,
  p_rating INTEGER,
  p_badge_type TEXT,
  p_giver_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_giver_auth_id UUID;
  v_receiver_auth_id UUID;
  v_new_rating NUMERIC;
  v_new_tasks INTEGER;
  v_role_context TEXT;
BEGIN
  -- 1. Fetch the job details
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- 2. Identify Giver and validate participation
  IF p_giver_role = 'poster' THEN
    v_role_context := 'tasker';
    -- Validate receiver has an accepted offer on the job
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id AND tasker_id = p_receiver_profile_id AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Receiver did not participate in this job';
    END IF;
  ELSIF p_giver_role = 'tasker' THEN
    v_role_context := 'poster';
    IF p_receiver_profile_id <> v_job.poster_id THEN
      RAISE EXCEPTION 'Receiver is not the poster of this job';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid role context';
  END IF;

  -- Resolve giver auth_id, fallback to profile ID if null
  SELECT auth_id INTO v_giver_auth_id FROM public.profiles WHERE id = p_giver_profile_id;
  IF v_giver_auth_id IS NULL THEN
    v_giver_auth_id := p_giver_profile_id;
  END IF;

  -- Resolve receiver auth_id, fallback to profile ID if null
  SELECT auth_id INTO v_receiver_auth_id FROM public.profiles WHERE id = p_receiver_profile_id;
  IF v_receiver_auth_id IS NULL THEN
    v_receiver_auth_id := p_receiver_profile_id;
  END IF;

  -- 4. Insert rating row into feedbacks table
  INSERT INTO public.feedbacks (giver_id, receiver_id, job_id, rating, role_context)
  VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_rating, v_role_context);
  
  -- Insert badge if provided
  IF p_badge_type IS NOT NULL AND p_badge_type <> '' THEN
    INSERT INTO public.reputation_badges (giver_id, receiver_id, job_id, badge_type, role_context)
    VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_badge_type, v_role_context);
  END IF;

  -- 5. Calculate average rating and tasks completed, and update receiver profile
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_new_rating, v_new_tasks
  FROM public.feedbacks
  WHERE receiver_id = v_receiver_auth_id AND role_context = v_role_context;

  UPDATE public.profiles
  SET rating = v_new_rating,
      tasks_completed = v_new_tasks
  WHERE id = p_receiver_profile_id;

  RETURN TRUE;
END;
$$;

-- 4. SUBMIT_USER_RATING (5-Parameter Legacy Signature)
CREATE OR REPLACE FUNCTION public.submit_user_rating(
  p_job_id UUID,
  p_giver_role TEXT,
  p_receiver_profile_id UUID,
  p_rating INTEGER,
  p_badge_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_giver_profile_id UUID;
BEGIN
  -- Resolve giver profile ID from auth.uid()
  SELECT id INTO v_giver_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  
  -- Fallback to job participants if auth.uid() is null
  IF v_giver_profile_id IS NULL THEN
    IF p_giver_role = 'poster' THEN
      SELECT poster_id INTO v_giver_profile_id FROM public.jobs WHERE id = p_job_id;
    ELSE
      SELECT tasker_id INTO v_giver_profile_id FROM public.jobs WHERE id = p_job_id;
    END IF;
  END IF;

  IF v_giver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized rating submission';
  END IF;

  RETURN public.submit_user_rating(p_job_id, p_giver_role, p_receiver_profile_id, p_rating, p_badge_type, v_giver_profile_id);
END;
$$;


-- 5. SUBMIT_USER_REPORT (5-Parameter Signature)
CREATE OR REPLACE FUNCTION public.submit_user_report(
  p_reported_profile_id UUID,
  p_job_id UUID,
  p_category TEXT,
  p_details TEXT,
  p_reporter_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reporter_auth_id UUID;
  v_reported_auth_id UUID;
BEGIN
  -- Resolve reporter's auth ID, fallback to profile ID if null
  SELECT auth_id INTO v_reporter_auth_id FROM public.profiles WHERE id = p_reporter_profile_id;
  IF v_reporter_auth_id IS NULL THEN
    v_reporter_auth_id := p_reporter_profile_id;
  END IF;

  -- Resolve reported user's auth ID, fallback to profile ID if null
  SELECT auth_id INTO v_reported_auth_id FROM public.profiles WHERE id = p_reported_profile_id;
  IF v_reported_auth_id IS NULL THEN
    v_reported_auth_id := p_reported_profile_id;
  END IF;

  -- Insert report row
  INSERT INTO public.reports (reporter_id, reported_user_id, job_id, category, details)
  VALUES (v_reporter_auth_id, v_reported_auth_id, p_job_id, p_category, p_details);

  RETURN TRUE;
END;
$$;

-- 6. SUBMIT_USER_REPORT (4-Parameter Legacy Signature)
CREATE OR REPLACE FUNCTION public.submit_user_report(
  p_reported_profile_id UUID,
  p_job_id UUID,
  p_category TEXT,
  p_details TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reporter_profile_id UUID;
BEGIN
  -- Resolve reporter profile ID from auth.uid()
  SELECT id INTO v_reporter_profile_id FROM public.profiles WHERE auth_id = auth.uid();
  
  -- Fallback to the other participant on the job if auth.uid() is null
  IF v_reporter_profile_id IS NULL THEN
    SELECT CASE 
      WHEN p_reported_profile_id = poster_id THEN tasker_id 
      ELSE poster_id 
    END INTO v_reporter_profile_id
    FROM public.jobs 
    WHERE id = p_job_id;
  END IF;

  IF v_reporter_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized report submission';
  END IF;

  RETURN public.submit_user_report(p_reported_profile_id, p_job_id, p_category, p_details, v_reporter_profile_id);
END;
$$;
