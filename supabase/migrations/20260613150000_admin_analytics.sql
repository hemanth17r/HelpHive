-- Admin Analytics RPCs for Marketplace Evolution

-- 1. get_demand_hotspots
-- Groups hirer waitlists by category and roughly by location (snapped to ~5km grid).
CREATE OR REPLACE FUNCTION public.get_demand_hotspots()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
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

-- 2. get_coverage_gaps
-- Identifies jobs that failed to match (expired while searching) to highlight supply gaps.
CREATE OR REPLACE FUNCTION public.get_coverage_gaps()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
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

-- 3. get_failed_first_experiences
-- Queries recent app_events for failed first jobs
CREATE OR REPLACE FUNCTION public.get_failed_first_experiences()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        SELECT 
            id::text as id,
            user_id as "userId",
            active_role as role,
            COALESCE(metadata->>'reason', 'UNKNOWN') as reason,
            created_at as date
        FROM public.app_events
        WHERE event_type = 'first_job_failed'
        ORDER BY created_at DESC
        LIMIT 50
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
