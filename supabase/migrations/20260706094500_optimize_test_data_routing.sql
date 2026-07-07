-- 20260706094500_optimize_test_data_routing.sql
-- 1. Add is_test column to profiles and jobs tables with indexes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_test ON public.profiles(is_test);
CREATE INDEX IF NOT EXISTS idx_jobs_is_test ON public.jobs(is_test);

-- 2. Trigger function to automatically calculate is_test for profiles
CREATE OR REPLACE FUNCTION public.sync_profile_is_test()
RETURNS TRIGGER AS $$
BEGIN
    NEW.is_test := (
        COALESCE(NEW.name, '') ILIKE '%test%'
        OR COALESCE(NEW.email, '') ILIKE '%test%'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_profile_is_test ON public.profiles;
CREATE TRIGGER tr_sync_profile_is_test
BEFORE INSERT OR UPDATE OF name, email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_test();

-- 3. Trigger function to automatically calculate is_test for jobs
CREATE OR REPLACE FUNCTION public.sync_job_is_test()
RETURNS TRIGGER AS $$
DECLARE
    v_poster_is_test BOOLEAN := FALSE;
BEGIN
    SELECT is_test INTO v_poster_is_test
    FROM public.profiles
    WHERE id = NEW.poster_id;

    NEW.is_test := (
        COALESCE(NEW.description, '') ILIKE '%[TEST]%'
        OR COALESCE(v_poster_is_test, FALSE)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_job_is_test ON public.jobs;
CREATE TRIGGER tr_sync_job_is_test
BEFORE INSERT OR UPDATE OF description, poster_id ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_job_is_test();

-- 4. Backfill existing records
UPDATE public.profiles
SET is_test = (name ILIKE '%test%' OR email ILIKE '%test%');

UPDATE public.jobs j
SET is_test = (
    COALESCE(j.description, '') ILIKE '%[TEST]%'
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = j.poster_id AND p.is_test = TRUE
    )
);

-- 5. Redefine dispatch_job_wave()
CREATE OR REPLACE FUNCTION public.dispatch_job_wave(p_job_id UUID, p_wave_number INT)
RETURNS INTEGER AS $$
DECLARE
    v_job RECORD;
    v_behavior RECORD;
    v_target_location GEOGRAPHY(POINT);
    v_radius_m INTEGER;
    v_stage VARCHAR;
    v_tasker_record RECORD;
    v_offers_created INTEGER := 0;
    
    -- Active pool parameters
    v_pool_config JSONB;
    v_growth_days INTEGER;
    v_mature_hours INTEGER;
    v_tasker_radius INTEGER;
    
    -- Sequential dispatch parameters
    v_target_active INTEGER;
    v_active_offers INTEGER;
    v_needed_offers INTEGER;
    v_accepted_offers INTEGER;
    v_remaining_needed INTEGER;
    
    -- Expiration parameters
    v_expires_interval INTERVAL;
    
    -- Fallback matching parameters
    v_exact_match_count INTEGER := 0;
    
    -- Test routing parameters
    v_is_test_job BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    v_is_test_job := COALESCE(v_job.is_test, FALSE);

    -- Get matching behavior
    SELECT mb.* INTO v_behavior
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = v_job.skill_id;

    IF NOT FOUND THEN
        SELECT * INTO v_behavior FROM public.matching_behaviors WHERE name = 'on_location' LIMIT 1;
    END IF;

    -- Determine center location
    IF v_behavior.location_strategy = 'primary_location' THEN
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    ELSIF v_behavior.location_strategy = 'secondary_location' THEN
        v_target_location := COALESCE(v_job.secondary_location, v_job.primary_location, v_job.location);
    ELSE
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    END IF;

    -- Determine radius based on wave number
    IF p_wave_number = 1 THEN v_radius_m := v_behavior.wave1_radius_m;
    ELSIF p_wave_number = 2 THEN v_radius_m := v_behavior.wave2_radius_m;
    ELSE v_radius_m := v_behavior.wave3_radius_m;
    END IF;

    -- Get marketplace stage and pool configurations
    v_stage := public.get_marketplace_stage(v_job.skill_id, ST_Y(v_target_location::geometry), ST_X(v_target_location::geometry), 20000);
    
    SELECT value INTO v_pool_config FROM public.marketplace_configurations WHERE key = 'active_pool_rules';
    v_growth_days := COALESCE((v_pool_config->>'growth_active_days')::INTEGER, 7);
    v_mature_hours := COALESCE((v_pool_config->>'mature_active_hours')::INTEGER, 24);

    -- Calculate remaining helpers needed
    SELECT count(*) INTO v_accepted_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    v_remaining_needed := COALESCE(v_job.people_needed, 1) - v_accepted_offers;
    IF v_remaining_needed <= 0 THEN
        RETURN 0;
    END IF;

    -- Define target active offers and expiration times based on stage and remaining helpers needed
    IF v_stage = 'bootstrap' THEN
        v_target_active := 10 * p_wave_number * v_remaining_needed;
        v_expires_interval := interval '10 minutes';
    ELSIF v_stage = 'growth' THEN
        v_target_active := 5 * p_wave_number * v_remaining_needed;
        v_expires_interval := interval '5 minutes';
    ELSE
        v_target_active := 2 * p_wave_number * v_remaining_needed;
        v_expires_interval := interval '2 minutes';
    END IF;

    -- Count active pending offers for this job
    SELECT count(*) INTO v_active_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'pending';

    v_needed_offers := v_target_active - v_active_offers;
    IF v_needed_offers <= 0 THEN
        RETURN 0;
    END IF;

    -- Count online exact category matches within range for this wave
    SELECT count(*) INTO v_exact_match_count
    FROM public.profiles p
    WHERE p.role = 'tasker'
      AND p.is_online = true
      AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
      AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
      AND p.upi_id IS NOT NULL AND p.upi_id != ''
      AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
      AND p.location IS NOT NULL
      AND v_job.skill_id = ANY(p.skills)
      AND p.id != v_job.poster_id
      -- Safe test routing filter (O(1) boolean check)
      AND (
          CASE 
              WHEN v_is_test_job THEN p.is_test
              ELSE NOT p.is_test
          END
      )
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
      AND (
          v_behavior.location_strategy = 'remote'
          OR (
              ST_DWithin(v_target_location, p.location, COALESCE(p.coverage_radius, 5000))
              AND ST_DWithin(v_target_location, p.location, v_radius_m)
              AND ST_DWithin(v_target_location, p.location, 50000)
          )
      );

    -- Find and loop through eligible taskers
    FOR v_tasker_record IN
        SELECT p.id, p.location, p.coverage_radius, p.last_active_at, p.is_online 
        FROM public.profiles p
        WHERE p.role = 'tasker'
          AND p.is_online = true
          AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
          AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
          AND p.upi_id IS NOT NULL AND p.upi_id != ''
          AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
          AND p.location IS NOT NULL
          AND (
              v_behavior.location_strategy = 'remote'
              OR ST_DWithin(v_target_location, p.location, 50000)
          )
          AND (
              (v_job.skill_id = ANY(p.skills))
              OR
              (p_wave_number > 1)
          )
          AND p.id != v_job.poster_id
          -- Safe test routing filter (O(1) boolean check)
          AND (
              CASE 
                  WHEN v_is_test_job THEN p.is_test
                  ELSE NOT p.is_test
              END
          )
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
        ORDER BY 
          (v_job.skill_id = ANY(p.skills)) DESC,
          p.location <-> v_target_location
    LOOP
        v_tasker_radius := COALESCE(v_tasker_record.coverage_radius, 5000);

        IF v_behavior.location_strategy != 'remote' THEN
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, 50000) THEN
                CONTINUE;
            END IF;
        ELSE
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) THEN
                CONTINUE;
            END IF;
        END IF;

        IF v_stage = 'growth' THEN
            IF v_tasker_record.last_active_at < (now() - (v_growth_days || ' days')::interval) THEN
                CONTINUE;
            END IF;
        ELSIF v_stage = 'mature' THEN
            IF v_tasker_record.last_active_at < (now() - (v_mature_hours || ' hours')::interval) THEN
                CONTINUE;
            END IF;
        END IF;

        INSERT INTO public.job_offers (
            job_id, tasker_id, status, amount_offered, wave_number, expires_at
        ) VALUES (
            p_job_id, v_tasker_record.id, 'pending', v_job.amount, p_wave_number, now() + v_expires_interval
        );
        
        v_offers_created := v_offers_created + 1;
        EXIT WHEN v_offers_created >= v_needed_offers;
    END LOOP;

    UPDATE public.jobs 
    SET max_wave_dispatched = p_wave_number 
    WHERE id = p_job_id;

    RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Redefine get_local_supply()
CREATE OR REPLACE FUNCTION public.get_local_supply(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_specific_count INTEGER;
    v_general_count INTEGER;
    v_target_location GEOGRAPHY(POINT);
    v_location_strategy VARCHAR;
BEGIN
    v_target_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    SELECT mb.location_strategy INTO v_location_strategy
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = p_category_id;

    IF COALESCE(v_location_strategy, 'on_location') = 'remote' THEN
        SELECT count(*) INTO v_specific_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Filter using fast is_test index
          AND NOT is_test
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND p_category_id = ANY(skills)
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );

        SELECT count(*) INTO v_general_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Filter using fast is_test index
          AND NOT is_test
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );
    ELSE
        SELECT count(*) INTO v_specific_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Filter using fast is_test index
          AND NOT is_test
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND p_category_id = ANY(skills)
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters))
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );

        SELECT count(*) INTO v_general_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Filter using fast is_test index
          AND NOT is_test
          AND phone IS NOT NULL AND phone != 'Add Phone' AND phone != ''
          AND upi_id IS NOT NULL AND upi_id != ''
          AND skills IS NOT NULL AND cardinality(skills) > 0
          AND location IS NOT NULL
          AND ST_DWithin(location, v_target_location, p_radius_meters)
          AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters))
          AND NOT EXISTS (
              SELECT 1 
              FROM public.jobs 
              WHERE tasker_id = profiles.id 
                AND v2_status IN ('accepted', 'en_route_to_primary', 'in_progress')
          );
    END IF;

    IF v_specific_count >= 1 THEN
        RETURN v_specific_count;
    ELSIF v_general_count >= 2 THEN
        RETURN v_general_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Redefine get_dashboard_stats()
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
  WHERE NOT p.is_test;

  -- 2. Count Serious Taskers (real users only)
  SELECT COUNT(DISTINCT p.id) INTO v_total_taskers 
  FROM public.profiles p
  WHERE p.location IS NOT NULL
    AND p.upi_id IS NOT NULL 
    AND p.upi_id != ''
    AND p.skills IS NOT NULL 
    AND cardinality(p.skills) > 0
    AND NOT p.is_test;

  -- 3. Count Serious Hirers (real users only)
  SELECT COUNT(DISTINCT p.id) INTO v_total_hirers 
  FROM public.profiles p
  WHERE p.name IS NOT NULL 
    AND p.name != 'New User' 
    AND p.name != 'Guest User' 
    AND p.name != ''
    AND NOT p.is_test
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
  AND NOT p.is_test;

  -- 5. Single-pass jobs aggregation (excluding test tasks)
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
  WHERE NOT j.is_test;

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
  WHERE NOT (COALESCE(p.is_test, false) OR COALESCE(j.is_test, false));

  -- 7. Count help reports today (excluding test accounts)
  SELECT COUNT(*) INTO v_help_reports_today 
  FROM public.help_reports hr
  LEFT JOIN public.profiles p ON p.id = hr.user_id
  WHERE hr.created_at >= CURRENT_DATE
    AND (p.id IS NULL OR NOT p.is_test);

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

-- 8. Redefine get_event_counts()
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
    AND NOT (COALESCE(p.is_test, false) OR COALESCE(j.is_test, false))
  GROUP BY ae.event_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Redefine get_daily_event_timeseries()
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
    AND NOT (COALESCE(p.is_test, false) OR COALESCE(j.is_test, false))
  GROUP BY ae.created_at::DATE
  ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Redefine get_recent_events()
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
  WHERE NOT (COALESCE(p.is_test, false) OR COALESCE(j.is_test, false))
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Redefine get_failed_first_experiences()
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
          AND NOT (p.is_test OR j.is_test)
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

-- 12. Redefine get_city_leaderboard()
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
      AND NOT p.is_test
    GROUP BY COALESCE(p.city, 'Unknown')
  ),
  city_hirers AS (
    SELECT COALESCE(ua.city, 'Unknown') as city, COUNT(DISTINCT ua.user_id) as count
    FROM public.user_addresses ua
    JOIN public.profiles p ON p.id = ua.user_id
    WHERE (ua.is_default = true OR ua.id IN (
      SELECT DISTINCT ON (user_id) id FROM public.user_addresses ORDER BY user_id, is_default DESC, created_at DESC
    ))
      AND NOT p.is_test
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

-- 13. Redefine get_demand_hotspots()
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
        WHERE p.id IS NULL OR NOT p.is_test
        GROUP BY hw.category_id, ST_SnapToGrid(hw.location::geometry, 0.05)
        ORDER BY "waitlistCount" DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Redefine get_coverage_gaps()
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
          AND NOT j.is_test
        GROUP BY j.skill_id, ST_SnapToGrid(j.location::geometry, 0.05)
        ORDER BY "missingSupply" DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Redefine get_unresolved_city_locations()
CREATE OR REPLACE FUNCTION public.get_unresolved_city_locations()
RETURNS TABLE(id UUID, type TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION) AS $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE auth_id = auth.uid() AND is_admin = true
  ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  -- Taskers with null city
  SELECT p.id, 'tasker'::TEXT, ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng
  FROM public.profiles p
  WHERE p.city IS NULL 
    AND p.location IS NOT NULL
    AND (p.role = 'tasker' OR (p.skills IS NOT NULL AND cardinality(p.skills) > 0) OR p.upi_id IS NOT NULL)
    AND NOT p.is_test
    
  UNION ALL
  
  -- Addresses with null city
  SELECT ua.id, 'address'::TEXT, ST_Y(ua.coordinates::geometry) as lat, ST_X(ua.coordinates::geometry) as lng
  FROM public.user_addresses ua
  LEFT JOIN public.profiles p ON p.id = ua.user_id
  WHERE ua.city IS NULL
    AND (p.id IS NULL OR NOT p.is_test);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
