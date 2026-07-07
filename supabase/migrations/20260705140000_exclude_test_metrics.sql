-- 20260705140000_exclude_test_metrics.sql
-- Exclude testing/E2E/mock accounts, test tasks/jobs, and associated events from the Admin Dashboard and Analytics RPCs.

-- Helper function or common definition:
-- A profile is a test account if: name ILIKE 'tester%' OR name ILIKE 'e2e%' OR email ILIKE 'tester%' OR email ILIKE 'e2e%'
-- A job is a test task if: description ILIKE '%[TEST]%' OR poster's profile is a test account.

-- 1. Redefine get_dashboard_stats()
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

  -- 1. Count total registered real accounts
  SELECT COUNT(*) INTO v_total_accounts 
  FROM public.profiles p
  WHERE NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%');

  -- 2. Count Serious Taskers (real users only)
  SELECT COUNT(DISTINCT p.id) INTO v_total_taskers 
  FROM public.profiles p
  WHERE p.location IS NOT NULL
    AND p.upi_id IS NOT NULL 
    AND p.upi_id != ''
    AND p.skills IS NOT NULL 
    AND cardinality(p.skills) > 0
    AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%');

  -- 3. Count Serious Hirers (real users only)
  SELECT COUNT(DISTINCT p.id) INTO v_total_hirers 
  FROM public.profiles p
  WHERE p.name IS NOT NULL 
    AND p.name != 'New User' 
    AND p.name != 'Guest User' 
    AND p.name != ''
    AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%')
    AND EXISTS (
        SELECT 1 FROM public.user_addresses ua
        WHERE ua.user_id = p.id
    );

  -- 4. Calculate Explorer Drop-offs (real accounts that completed NEITHER onboarding path)
  SELECT COUNT(*) INTO v_explorer_drop_off
  FROM public.profiles p
  WHERE NOT (
    -- Serious Tasker
    (p.location IS NOT NULL
     AND p.upi_id IS NOT NULL 
     AND p.upi_id != ''
     AND p.skills IS NOT NULL 
     AND cardinality(p.skills) > 0)
    OR
    -- Serious Hirer
    (p.name IS NOT NULL 
     AND p.name != 'New User' 
     AND p.name != 'Guest User' 
     AND p.name != ''
     AND EXISTS (
         SELECT 1 FROM public.user_addresses ua
         WHERE ua.user_id = p.id
     ))
  )
  AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%');

  -- 5. Single-pass jobs aggregation (excluding test tasks and test posters)
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
  FROM public.jobs j
  LEFT JOIN public.profiles p ON p.id = j.poster_id
  WHERE NOT (j.description ILIKE '%[TEST]%' OR p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%');

  -- 6. Single-pass events aggregation (excluding test events/users/jobs)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE),
    COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE ae.event_type = 'signup' AND ae.created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE ae.event_type = 'login' AND ae.created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE ae.event_type = 'task_acceptance' AND ae.created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE ae.event_type = 'task_completion' AND ae.created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE ae.event_type IN ('task_cancelled_by_poster', 'task_cancelled_by_tasker', 'task_cancellation') AND ae.created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE ae.event_type = 'report_submitted' AND ae.created_at >= CURRENT_DATE)
  INTO 
    v_total_events, v_events_today, v_users_today, v_signups_today, v_logins_today, v_acceptances_today, v_completions_today, v_cancellations_today, v_reports_today
  FROM public.app_events ae
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  LEFT JOIN public.jobs j ON j.id = ae.entity_id
  WHERE NOT (
    p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%'
    OR j.description ILIKE '%[TEST]%'
  );

  -- 7. Count help reports today (excluding test accounts)
  SELECT COUNT(*) INTO v_help_reports_today 
  FROM public.help_reports hr
  LEFT JOIN public.profiles p ON p.id = hr.user_id
  WHERE hr.created_at >= CURRENT_DATE
    AND (p.id IS NULL OR NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%'));

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


-- 2. Redefine get_event_counts()
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
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  LEFT JOIN public.jobs j ON j.id = ae.entity_id
  WHERE ae.created_at >= p_start_date AND ae.created_at <= p_end_date
    AND NOT (
      p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%'
      OR j.description ILIKE '%[TEST]%'
    )
  GROUP BY ae.event_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Redefine get_daily_event_timeseries()
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
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  LEFT JOIN public.jobs j ON j.id = ae.entity_id
  WHERE (p_event_type IS NULL OR ae.event_type = p_event_type)
    AND ae.created_at >= (now() - (p_days || ' days')::interval)
    AND NOT (
      p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%'
      OR j.description ILIKE '%[TEST]%'
    )
  GROUP BY ae.created_at::DATE
  ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Redefine get_recent_events()
CREATE OR REPLACE FUNCTION public.get_recent_events(p_limit INTEGER)
RETURNS TABLE(
  id UUID,
  event_type TEXT,
  user_id UUID,
  user_name TEXT,
  user_phone TEXT,
  active_role TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  SELECT 
    ae.id,
    ae.event_type,
    ae.user_id,
    p.name as user_name,
    p.phone as user_phone,
    ae.active_role,
    ae.entity_id,
    ae.metadata,
    ae.created_at
  FROM public.app_events ae
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  LEFT JOIN public.jobs j ON j.id = ae.entity_id
  WHERE NOT (
    p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%'
    OR j.description ILIKE '%[TEST]%'
  )
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Redefine get_failed_first_experiences()
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
          AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%' OR j.description ILIKE '%[TEST]%')
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


-- 6. Redefine get_city_leaderboard()
CREATE OR REPLACE FUNCTION public.get_city_leaderboard()
RETURNS TABLE(city_name TEXT, tasker_count BIGINT, hirer_count BIGINT, total_count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  WITH city_taskers AS (
    SELECT COALESCE(p.city, 'Unknown') as city, COUNT(DISTINCT p.id) as count
    FROM public.profiles p
    WHERE (p.role = 'tasker' OR (p.skills IS NOT NULL AND cardinality(p.skills) > 0) OR p.upi_id IS NOT NULL)
      AND p.location IS NOT NULL
      AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%')
    GROUP BY COALESCE(p.city, 'Unknown')
  ),
  city_hirers AS (
    SELECT COALESCE(ua.city, 'Unknown') as city, COUNT(DISTINCT ua.user_id) as count
    FROM public.user_addresses ua
    JOIN public.profiles p ON p.id = ua.user_id
    WHERE (ua.is_default = true OR ua.id IN (
      SELECT DISTINCT ON (user_id) id FROM public.user_addresses ORDER BY user_id, is_default DESC, created_at DESC
    ))
      AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%')
    GROUP BY COALESCE(ua.city, 'Unknown')
  ),
  all_cities AS (
    SELECT DISTINCT city FROM city_taskers
    UNION
    SELECT DISTINCT city FROM city_hirers
  )
  SELECT 
    ac.city::TEXT as city_name,
    COALESCE(ct.count, 0)::BIGINT as tasker_count,
    COALESCE(ch.count, 0)::BIGINT as hirer_count,
    (COALESCE(ct.count, 0) + COALESCE(ch.count, 0))::BIGINT as total_count
  FROM all_cities ac
  LEFT JOIN city_taskers ct ON ct.city = ac.city
  LEFT JOIN city_hirers ch ON ch.city = ac.city
  WHERE ac.city != 'Unknown' AND ac.city != ''
  ORDER BY total_count DESC, city_name ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Redefine get_demand_hotspots()
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
            md5(hw.category_id || ST_AsText(ST_SnapToGrid(hw.location::geometry, 0.05))) as id,
            ST_Y(ST_Centroid(ST_Collect(hw.location::geometry))) as lat,
            ST_X(ST_Centroid(ST_Collect(hw.location::geometry))) as lng,
            'Area ' || hw.category_id as label,
            COALESCE(
              (
                SELECT SPLIT_PART(ua.formatted_address, ',', 1)
                FROM public.user_addresses ua
                ORDER BY ua.coordinates <-> ST_Centroid(ST_Collect(hw.location::geometry))::geography
                LIMIT 1
              ),
              'Unknown Location'
            ) as "locationName",
            hw.category_id as "categoryId",
            COUNT(*) as "waitlistCount",
            COUNT(*) as "supplyDeficit",
            CASE 
                WHEN COUNT(*) > 20 THEN 'high'
                WHEN COUNT(*) > 10 THEN 'medium'
                ELSE 'low'
            END as urgency
        FROM public.hirer_waitlists hw
        LEFT JOIN public.profiles p ON p.id = hw.poster_id
        WHERE p.id IS NULL OR NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%')
        GROUP BY hw.category_id, ST_SnapToGrid(hw.location::geometry, 0.05)
        ORDER BY "waitlistCount" DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Redefine get_coverage_gaps()
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
            md5(j.skill_id || ST_AsText(ST_SnapToGrid(j.location::geometry, 0.05))) as id,
            ST_Y(ST_Centroid(ST_Collect(j.location::geometry))) as lat,
            ST_X(ST_Centroid(ST_Collect(j.location::geometry))) as lng,
            'Gap Area ' || j.skill_id as label,
            COALESCE(
              (
                SELECT SPLIT_PART(ua.formatted_address, ',', 1)
                FROM public.user_addresses ua
                ORDER BY ua.coordinates <-> ST_Centroid(ST_Collect(j.location::geometry))::geography
                LIMIT 1
              ),
              'Unknown Location'
            ) as "locationName",
            j.skill_id as "categoryId",
            COUNT(*) as "missingSupply",
            COUNT(*) as "demandVolume"
        FROM public.jobs j
        LEFT JOIN public.profiles p ON p.id = j.poster_id
        WHERE j.v2_status IN ('searching', 'cancelled')
          AND j.created_at < now() - interval '24 hours'
          AND j.tasker_id IS NULL
          AND NOT (j.description ILIKE '%[TEST]%' OR p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%')
        GROUP BY j.skill_id, ST_SnapToGrid(j.location::geometry, 0.05)
        ORDER BY "missingSupply" DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
