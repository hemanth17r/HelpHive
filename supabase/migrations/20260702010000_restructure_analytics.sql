-- 20260702010000_restructure_analytics.sql
-- Redefine get_dashboard_stats to return strict counts of serious taskers/hirers and total accounts, fixing the double-subtraction overlap bug

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
  v_total_taskers BIGINT;
  v_total_hirers BIGINT;
  v_total_accounts BIGINT;
  v_explorer_drop_off BIGINT;
  
  -- Jobs counts
  v_total_jobs BIGINT;
  v_open_jobs BIGINT;
  v_accepted_jobs BIGINT;
  v_completed_jobs BIGINT;
  v_expired_jobs BIGINT;
  v_active_jobs BIGINT;
  v_jobs_today BIGINT;

  -- Event counts
  v_total_events BIGINT;
  v_events_today BIGINT;
  v_users_today BIGINT;
  v_signups_today BIGINT;
  v_logins_today BIGINT;
  v_acceptances_today BIGINT;
  v_completions_today BIGINT;
  v_cancellations_today BIGINT;
  v_reports_today BIGINT;
  v_help_reports_today BIGINT;
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  -- 1. Count total registered accounts
  SELECT COUNT(*) INTO v_total_accounts FROM public.profiles;

  -- 2. Count Serious Taskers
  -- Must have: skills set, static location set, and UPI ID set.
  SELECT COUNT(DISTINCT p.id) INTO v_total_taskers 
  FROM public.profiles p
  WHERE p.location IS NOT NULL
    AND p.upi_id IS NOT NULL 
    AND p.upi_id != ''
    AND p.skills IS NOT NULL 
    AND cardinality(p.skills) > 0;

  -- 3. Count Serious Hirers
  -- Must have: custom non-default name set, and at least one address in user_addresses table.
  SELECT COUNT(DISTINCT p.id) INTO v_total_hirers 
  FROM public.profiles p
  WHERE p.name IS NOT NULL 
    AND p.name != 'New User' 
    AND p.name != 'Guest User' 
    AND p.name != ''
    AND EXISTS (
        SELECT 1 FROM public.user_addresses ua
        WHERE ua.user_id = p.id
    );

  -- 4. Calculate Explorer Drop-offs (accounts that completed NEITHER onboarding path)
  SELECT COUNT(*) INTO v_explorer_drop_off
  FROM public.profiles p
  WHERE NOT (
    -- NOT a Serious Tasker
    (p.location IS NOT NULL
     AND p.upi_id IS NOT NULL 
     AND p.upi_id != ''
     AND p.skills IS NOT NULL 
     AND cardinality(p.skills) > 0)
    OR
    -- NOT a Serious Hirer
    (p.name IS NOT NULL 
     AND p.name != 'New User' 
     AND p.name != 'Guest User' 
     AND p.name != ''
     AND EXISTS (
         SELECT 1 FROM public.user_addresses ua
         WHERE ua.user_id = p.id
     ))
  );

  -- 5. Single-pass jobs aggregation
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'open'),
    COUNT(*) FILTER (WHERE status = 'accepted'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'expired'),
    COUNT(*) FILTER (WHERE status IN ('open', 'accepted')),
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)
  INTO 
    v_total_jobs, v_open_jobs, v_accepted_jobs, v_completed_jobs, v_expired_jobs, v_active_jobs, v_jobs_today
  FROM public.jobs;

  -- 6. Single-pass events aggregation
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE event_type = 'signup' AND created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE event_type = 'login' AND created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE event_type = 'task_acceptance' AND created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE event_type = 'task_completion' AND created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE event_type IN ('task_cancelled_by_poster', 'task_cancelled_by_tasker', 'task_cancellation') AND created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE event_type = 'report_submitted' AND created_at >= CURRENT_DATE)
  INTO 
    v_total_events, v_events_today, v_users_today, v_signups_today, v_logins_today, v_acceptances_today, v_completions_today, v_cancellations_today, v_reports_today
  FROM public.app_events;

  -- 7. Count help reports today
  SELECT COUNT(*) INTO v_help_reports_today 
  FROM public.help_reports 
  WHERE created_at >= CURRENT_DATE;

  -- 8. Construct JSON response
  v_stats := jsonb_build_object(
    'total_accounts', v_total_accounts,
    'explorer_drop_off', v_explorer_drop_off,
    'total_taskers', v_total_taskers,
    'total_hirers', v_total_hirers,
    'total_jobs', v_total_jobs,
    'open_jobs', v_open_jobs,
    'accepted_jobs', v_accepted_jobs,
    'completed_jobs', v_completed_jobs,
    'expired_jobs', v_expired_jobs,
    'active_jobs', v_active_jobs,
    'jobs_today', v_jobs_today,
    'total_events', v_total_events,
    'events_today', v_events_today,
    'users_today', v_users_today,
    'signups_today', v_signups_today,
    'logins_today', v_logins_today,
    'acceptances_today', v_acceptances_today,
    'completions_today', v_completions_today,
    'cancellations_today', v_cancellations_today,
    'reports_today', v_reports_today + v_help_reports_today
  );
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
