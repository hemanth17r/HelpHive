-- MIGRATION: 20260811000000_phase1_skill_matrix_foundation.sql
-- Description: Phase 1 of HelpHive Upgrade. Adds additive skill_matrix, reliability_score, and total_completed_jobs columns to profiles, skill_tags to jobs, and implements automatic background skill_matrix synchronization upon job feedback without altering existing UI or dispatch matching logic.

-- 1. Additive Column Additions to profiles & jobs
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS skill_matrix JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC DEFAULT 100.0,
  ADD COLUMN IF NOT EXISTS total_completed_jobs INT DEFAULT 0;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] DEFAULT '{}'::text[];

-- 2. Helper function to synchronize tasker skill matrix & reliability score
CREATE OR REPLACE FUNCTION public.sync_tasker_skill_matrix(
  p_tasker_profile_id UUID,
  p_skill_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tasker_auth_id UUID;
  v_skill_completed INTEGER := 0;
  v_skill_avg_rating NUMERIC := 0.0;
  v_overall_avg NUMERIC := 0.0;
  v_total_completed INTEGER := 0;
  v_reliability NUMERIC := 100.0;
  v_matrix JSONB;
BEGIN
  IF p_tasker_profile_id IS NULL OR p_skill_id IS NULL OR p_skill_id = '' THEN
    RETURN;
  END IF;

  -- Resolve auth_id for tasker
  SELECT auth_id INTO v_tasker_auth_id FROM public.profiles WHERE id = p_tasker_profile_id;
  IF v_tasker_auth_id IS NULL THEN
    v_tasker_auth_id := p_tasker_profile_id;
  END IF;

  -- Calculate stats for this specific skill_id
  SELECT 
    COUNT(f.id),
    COALESCE(AVG(f.rating), 0)
  INTO 
    v_skill_completed,
    v_skill_avg_rating
  FROM public.feedbacks f
  JOIN public.jobs j ON j.id = f.job_id
  WHERE (f.receiver_id = v_tasker_auth_id OR f.receiver_id = p_tasker_profile_id)
    AND f.role_context = 'tasker'
    AND j.skill_id = p_skill_id;

  -- Calculate overall total completed & overall avg rating for tasker
  SELECT 
    COUNT(f.id),
    COALESCE(AVG(f.rating), 5.0)
  INTO 
    v_total_completed,
    v_overall_avg
  FROM public.feedbacks f
  WHERE (f.receiver_id = v_tasker_auth_id OR f.receiver_id = p_tasker_profile_id)
    AND f.role_context = 'tasker';

  -- Calculate reliability score (overall avg rating / 5.0 * 100)
  v_reliability := ROUND((v_overall_avg / 5.0) * 100.0, 1);

  -- Get current skill_matrix JSONB and update entry for p_skill_id
  SELECT COALESCE(skill_matrix, '{}'::jsonb) INTO v_matrix FROM public.profiles WHERE id = p_tasker_profile_id;
  
  v_matrix := jsonb_set(
    v_matrix,
    ARRAY[p_skill_id],
    jsonb_build_object(
      'completed', v_skill_completed,
      'rating', ROUND(v_skill_avg_rating, 2)
    ),
    true
  );

  -- Update profiles record
  UPDATE public.profiles
  SET skill_matrix = v_matrix,
      reliability_score = v_reliability,
      total_completed_jobs = v_total_completed
  WHERE id = p_tasker_profile_id;
END;
$$;

-- 3. Update primary submit_user_rating (6-parameter signature) to invoke sync_tasker_skill_matrix
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

  -- 6. Phase 1 Addition: Sync skill matrix if poster rated a tasker
  IF p_giver_role = 'poster' AND v_job.skill_id IS NOT NULL THEN
    PERFORM public.sync_tasker_skill_matrix(p_receiver_profile_id, v_job.skill_id);
  END IF;

  RETURN TRUE;
END;
$$;

-- 4. Backfill existing historical feedbacks into skill_matrix for active taskers
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN 
    SELECT DISTINCT p.id AS profile_id, j.skill_id
    FROM public.profiles p
    JOIN public.feedbacks f ON (f.receiver_id = p.auth_id OR f.receiver_id = p.id) AND f.role_context = 'tasker'
    JOIN public.jobs j ON j.id = f.job_id
    WHERE j.skill_id IS NOT NULL
  LOOP
    PERFORM public.sync_tasker_skill_matrix(v_rec.profile_id, v_rec.skill_id);
  END LOOP;
END;
$$;
