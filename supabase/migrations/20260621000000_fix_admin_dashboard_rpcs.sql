-- =============================================================================
-- HelpHive Fix Admin Dashboard and Analytics RPCs Migration
-- =============================================================================

-- 1. Redefine get_dashboard_stats() to return flat count fields at the root
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
  v_total_taskers BIGINT;
  v_total_hirers BIGINT;
  
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

  -- 1. Count taskers and hirers
  SELECT COUNT(DISTINCT p.id) INTO v_total_taskers FROM public.profiles p
  WHERE p.role = 'tasker'
     OR (p.skills IS NOT NULL AND cardinality(p.skills) > 0)
     OR p.upi_id IS NOT NULL
     OR EXISTS (
         SELECT 1 FROM public.app_events ae
         WHERE ae.user_id = p.id AND ae.active_role = 'tasker'
     );

  SELECT COUNT(DISTINCT p.id) INTO v_total_hirers FROM public.profiles p
  WHERE p.role = 'poster'
     OR EXISTS (
         SELECT 1 FROM public.jobs j
         WHERE j.poster_id = p.id
     )
     OR EXISTS (
         SELECT 1 FROM public.user_addresses ua
         WHERE ua.user_id = p.id
     )
     OR EXISTS (
         SELECT 1 FROM public.app_events ae
         WHERE ae.user_id = p.id AND ae.active_role = 'poster'
     );

  -- 2. Single-pass jobs aggregation
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

  -- 3. Single-pass events aggregation
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

  -- 4. Count help reports today
  SELECT COUNT(*) INTO v_help_reports_today 
  FROM public.help_reports 
  WHERE created_at >= CURRENT_DATE;

  -- 5. Construct JSON response
  v_stats := jsonb_build_object(
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


-- 2. Drop and recreate get_event_counts() with defaults and matching columns
DROP FUNCTION IF EXISTS public.get_event_counts(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.get_event_counts(
  p_start_date TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(event_type TEXT, event_count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT ae.event_type, COUNT(*)::BIGINT as event_count
  FROM public.app_events ae
  WHERE ae.created_at >= p_start_date AND ae.created_at <= p_end_date
  GROUP BY ae.event_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Drop and recreate get_daily_event_timeseries() with defaults and matching columns
DROP FUNCTION IF EXISTS public.get_daily_event_timeseries(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_daily_event_timeseries(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_daily_event_timeseries(
  p_event_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(day DATE, event_count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT ae.created_at::DATE as day, COUNT(*)::BIGINT as event_count
  FROM public.app_events ae
  WHERE (p_event_type IS NULL OR ae.event_type = p_event_type)
    AND ae.created_at >= (now() - (p_days || ' days')::interval)
  GROUP BY ae.created_at::DATE
  ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Redefine get_demand_hotspots() to group waitlists and return camelCase JSON array
DROP FUNCTION IF EXISTS public.get_demand_hotspots(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS public.get_demand_hotspots();

CREATE OR REPLACE FUNCTION public.get_demand_hotspots()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE auth_id = auth.uid() AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required.';
    END IF;

    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        SELECT 
            md5(category_id || ST_AsText(ST_SnapToGrid(location::geometry, 0.05))) as id,
            ST_Y(ST_Centroid(ST_Collect(location::geometry))) as lat,
            ST_X(ST_Centroid(ST_Collect(location::geometry))) as lng,
            'Area ' || category_id as label,
            category_id as "categoryId",
            COUNT(*) as "waitlistCount",
            COUNT(*) as "supplyDeficit",
            CASE 
                WHEN COUNT(*) > 20 THEN 'high'
                WHEN COUNT(*) > 10 THEN 'medium'
                ELSE 'low'
            END as urgency
        FROM public.hirer_waitlists
        GROUP BY category_id, ST_SnapToGrid(location::geometry, 0.05)
        ORDER BY "waitlistCount" DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Redefine get_coverage_gaps() to analyze failed matches and return camelCase JSON array
DROP FUNCTION IF EXISTS public.get_coverage_gaps(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS public.get_coverage_gaps();

CREATE OR REPLACE FUNCTION public.get_coverage_gaps()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE auth_id = auth.uid() AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required.';
    END IF;

    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        SELECT 
            md5(skill_id || ST_AsText(ST_SnapToGrid(location::geometry, 0.05))) as id,
            ST_Y(ST_Centroid(ST_Collect(location::geometry))) as lat,
            ST_X(ST_Centroid(ST_Collect(location::geometry))) as lng,
            'Gap Area ' || skill_id as label,
            skill_id as "categoryId",
            COUNT(*) as "missingSupply",
            COUNT(*) as "demandVolume"
        FROM public.jobs
        WHERE v2_status IN ('searching', 'cancelled')
          AND created_at < now() - interval '24 hours'
          AND tasker_id IS NULL
        GROUP BY skill_id, ST_SnapToGrid(location::geometry, 0.05)
        ORDER BY "missingSupply" DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Redefine get_failed_first_experiences() to return camelCase JSON array of first_job_failed events
DROP FUNCTION IF EXISTS public.get_failed_first_experiences(INTEGER);
DROP FUNCTION IF EXISTS public.get_failed_first_experiences();

CREATE OR REPLACE FUNCTION public.get_failed_first_experiences()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE auth_id = auth.uid() AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required.';
    END IF;

    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        SELECT 
            ae.id::text as id,
            ae.user_id as "userId",
            ae.active_role as role,
            COALESCE(ae.metadata->>'reason', ae.metadata->>'failure_reason', 'UNKNOWN') as reason,
            ae.created_at as date,
            p.name as "userName",
            p.phone as "userPhone"
        FROM public.app_events ae
        JOIN public.profiles p ON p.id = ae.user_id
        JOIN public.jobs j ON j.id = ae.entity_id
        WHERE ae.event_type = 'first_job_failed'
          AND NOT EXISTS (
            SELECT 1 FROM public.jobs j2
            WHERE (
              (ae.active_role = 'poster' AND j2.poster_id = ae.user_id) OR
              (ae.active_role = 'tasker' AND j2.tasker_id = ae.user_id)
            )
            AND j2.status = 'completed'
            AND j2.created_at < ae.created_at
          )
        ORDER BY ae.created_at DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
