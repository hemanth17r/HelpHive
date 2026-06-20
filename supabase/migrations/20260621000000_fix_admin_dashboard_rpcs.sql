-- =============================================================================
-- HelpHive Fix Admin Dashboard and Analytics RPCs Migration
-- =============================================================================

-- 1. Redefine get_dashboard_stats() to return flat count fields at the root
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_jobs', (SELECT COUNT(*) FROM public.jobs),
    'total_events', (SELECT COUNT(*) FROM public.app_events),
    'events_today', (SELECT COUNT(*) FROM public.app_events WHERE created_at >= CURRENT_DATE),
    'users_today', (SELECT COUNT(DISTINCT user_id) FROM public.app_events WHERE created_at >= CURRENT_DATE),
    'active_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status IN ('open', 'accepted')),
    'jobs_today', (SELECT COUNT(*) FROM public.jobs WHERE created_at >= CURRENT_DATE),
    'open_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'open'),
    'accepted_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'accepted'),
    'completed_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'completed'),
    'expired_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'expired')
  ) INTO v_stats;
  
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
            ae.created_at as date
        FROM public.app_events ae
        JOIN public.jobs j ON j.id = ae.entity_id
        JOIN public.profiles p ON p.id = j.poster_id
        WHERE ae.event_type = 'first_job_failed'
          AND NOT EXISTS (
            SELECT 1 FROM public.jobs j2
            WHERE j2.poster_id = p.id 
              AND j2.status = 'completed'
              AND j2.created_at < ae.created_at
          )
        ORDER BY ae.created_at DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
