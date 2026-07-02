-- Redefine verify_job_otp to remove invalid started_at column update and strictly verify the caller is the assigned tasker
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

  -- Security Check: Ensure the caller is the assigned tasker
  -- (v_job.tasker_id refers to profiles.id; auth.uid() refers to profiles.auth_id)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_job.tasker_id AND auth_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  -- Verify OTP and atomically update the job status
  IF v_job.otp = p_otp THEN
    -- Only update status if it is currently in 'accepted' or 'active' state
    IF v_job.status = 'active' OR v_job.status = 'accepted' THEN
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


-- Define submit_user_rating to securely insert ratings/badges and update receiver profiles in real-time
CREATE OR REPLACE FUNCTION public.submit_user_rating(
  p_job_id UUID,
  p_giver_role TEXT, -- 'poster' or 'tasker'
  p_rating INTEGER,
  p_badge_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_giver_profile_id UUID;
  v_receiver_profile_id UUID;
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

  -- 2. Identify Giver and Receiver profile IDs based on who is rating
  IF p_giver_role = 'poster' THEN
    v_giver_profile_id := v_job.poster_id;
    v_receiver_profile_id := v_job.tasker_id;
    v_role_context := 'tasker';
  ELSIF p_giver_role = 'tasker' THEN
    v_giver_profile_id := v_job.tasker_id;
    v_receiver_profile_id := v_job.poster_id;
    v_role_context := 'poster';
  ELSE
    RAISE EXCEPTION 'Invalid role context';
  END IF;

  -- Ensure we have both giver and receiver profiles
  IF v_giver_profile_id IS NULL OR v_receiver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profiles not resolved';
  END IF;

  -- 3. Resolve auth_ids from profiles table (giver must be the caller)
  SELECT auth_id INTO v_giver_auth_id FROM public.profiles WHERE id = v_giver_profile_id;
  SELECT auth_id INTO v_receiver_auth_id FROM public.profiles WHERE id = v_receiver_profile_id;

  -- Security check: Ensure the caller is indeed the giver
  IF v_giver_auth_id IS NULL OR v_giver_auth_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized rating submission';
  END IF;

  IF v_receiver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Receiver auth record not found';
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
  WHERE id = v_receiver_profile_id;

  RETURN TRUE;
END;
$$;
