-- =============================================================
-- Secondary Audit Fixes – HelpHive V2
-- 2026-06-18
-- =============================================================

-- ----------------------------------------------------------
-- FIX 1.1: Profiles UPDATE policy – prevent NULL auth_id hijacking
-- Previously any authenticated user could update a profile
-- row where auth_id IS NULL (a pre-registered phone-only
-- profile) and stamp their own auth_id on it, effectively
-- stealing the account.
-- New rule: a NULL-auth_id row may only be claimed if the
-- caller's authenticated email OR phone matches the stored
-- email/phone on that profile row.
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
  auth_id = auth.uid()
  OR (
    auth_id IS NULL
    AND (
      email = auth.email()
      OR phone = (auth.jwt() ->> 'phone')
    )
  )
)
WITH CHECK (
  auth_id = auth.uid()
  OR (
    auth_id IS NULL
    AND (
      email = auth.email()
      OR phone = (auth.jwt() ->> 'phone')
    )
  )
);


-- ----------------------------------------------------------
-- FIX 1.2: help_reports – admin SELECT and UPDATE policies
-- Previously there were no admin-level policies, which meant
-- api.getHelpReports() always returned empty for admins, and
-- api.updateHelpReportStatus() always failed silently.
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all help reports" ON public.help_reports;
DROP POLICY IF EXISTS "Admins can update help reports" ON public.help_reports;

CREATE POLICY "Admins can view all help reports"
ON public.help_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND is_admin = true
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Admins can update help reports"
ON public.help_reports FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND is_admin = true
  )
);


-- ----------------------------------------------------------
-- FIX 1.3: reports table SELECT policy – broken column reference
-- The old policy referenced a non-existent column `user_id`,
-- crashing every query on this table. Replace with the actual
-- column names: reporter_id and reported_user_id.
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their reports" ON public.reports;

CREATE POLICY "Users can view their reports"
ON public.reports FOR SELECT
USING (
  reporter_id = auth.uid()
  OR reported_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND is_admin = true
  )
);


-- ----------------------------------------------------------
-- FIX 1.4: app_events SELECT policy – wrong column comparison
-- The old policy compared app_events.user_id (which holds an
-- auth UID, i.e. uuid matching auth.users.id) against
-- profiles.id (a profile UUID that is DIFFERENT from auth.uid()).
-- Correct comparison: user_id = auth.uid() directly.
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own events" ON public.app_events;
DROP POLICY IF EXISTS "Users can read own events" ON public.app_events;

CREATE POLICY "Users can read own events"
ON public.app_events FOR SELECT
USING (user_id = auth.uid());


-- ----------------------------------------------------------
-- FIX 1.5: submit_user_rating – prevent duplicate rating spam
-- Add an upfront duplicate check: if a feedback row already
-- exists for the same (giver_id, job_id, role_context) combo,
-- raise an exception instead of inserting a second row.
-- This replaces the current version defined in migration
-- 20260617170000_audit_fixes.sql.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_user_rating(
  p_job_id UUID,
  p_giver_role TEXT,           -- 'poster' or 'tasker'
  p_receiver_profile_id UUID,
  p_rating INTEGER,
  p_badge_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job              RECORD;
  v_giver_profile_id UUID;
  v_giver_auth_id    UUID;
  v_receiver_auth_id UUID;
  v_new_rating       NUMERIC;
  v_new_tasks        INTEGER;
  v_role_context     TEXT;
BEGIN
  -- 1. Fetch the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- 2. Determine role context and validate participation
  IF p_giver_role = 'poster' THEN
    v_role_context := 'tasker';
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id
        AND tasker_id = p_receiver_profile_id
        AND status = 'accepted'
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

  -- 3. Resolve caller profile and auth_id (caller MUST be the giver)
  SELECT id, auth_id
  INTO v_giver_profile_id, v_giver_auth_id
  FROM public.profiles
  WHERE auth_id = auth.uid();

  IF v_giver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized rating submission';
  END IF;

  -- 4. Extra check: if tasker is rating, validate they have an accepted offer
  IF p_giver_role = 'tasker' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_id = p_job_id
        AND tasker_id = v_giver_profile_id
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Giver did not participate in this job';
    END IF;
  END IF;

  -- 5. Resolve receiver auth_id
  SELECT auth_id INTO v_receiver_auth_id
  FROM public.profiles
  WHERE id = p_receiver_profile_id;

  IF v_receiver_auth_id IS NULL THEN
    RAISE EXCEPTION 'Receiver profile not found';
  END IF;

  -- 6. Duplicate-rating guard – prevent spam
  IF EXISTS (
    SELECT 1 FROM public.feedbacks
    WHERE giver_id      = v_giver_auth_id
      AND job_id        = p_job_id
      AND role_context  = v_role_context
  ) THEN
    RAISE EXCEPTION 'Rating already submitted for this job';
  END IF;

  -- 7. Insert the feedback row
  INSERT INTO public.feedbacks (giver_id, receiver_id, job_id, rating, role_context)
  VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_rating, v_role_context);

  -- 8. Insert badge if provided
  IF p_badge_type IS NOT NULL AND p_badge_type <> '' THEN
    INSERT INTO public.reputation_badges (giver_id, receiver_id, job_id, badge_type, role_context)
    VALUES (v_giver_auth_id, v_receiver_auth_id, p_job_id, p_badge_type, v_role_context);
  END IF;

  -- 9. Recalculate and update receiver profile rating
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_new_rating, v_new_tasks
  FROM public.feedbacks
  WHERE receiver_id = v_receiver_auth_id
    AND role_context = v_role_context;

  UPDATE public.profiles
  SET rating          = v_new_rating,
      tasks_completed = v_new_tasks
  WHERE id = p_receiver_profile_id;

  RETURN TRUE;
END;
$$;
