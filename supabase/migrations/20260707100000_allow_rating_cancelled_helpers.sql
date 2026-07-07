-- Migration to allow rating helpers who left/cancelled the task (status = 'rejected')
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
    -- Validate receiver has an accepted or rejected (left) offer on the job
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id AND tasker_id = p_receiver_profile_id AND status IN ('accepted', 'rejected')
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
