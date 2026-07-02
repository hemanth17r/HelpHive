-- Redefine get_demand_hotspots() to include local address fallback locationName
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
            COALESCE(
              (
                SELECT SPLIT_PART(ua.formatted_address, ',', 1)
                FROM public.user_addresses ua
                ORDER BY ua.coordinates <-> ST_Centroid(ST_Collect(location::geometry))::geography
                LIMIT 1
              ),
              'Unknown Location'
            ) as "locationName",
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


-- Redefine get_coverage_gaps() to include local address fallback locationName
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
            COALESCE(
              (
                SELECT SPLIT_PART(ua.formatted_address, ',', 1)
                FROM public.user_addresses ua
                ORDER BY ua.coordinates <-> ST_Centroid(ST_Collect(location::geometry))::geography
                LIMIT 1
              ),
              'Unknown Location'
            ) as "locationName",
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
