-- 20260705150000_exclude_test_supply.sql
-- Redefine get_local_supply() and get_unresolved_city_locations() to exclude test/E2E/mock profiles,
-- ensuring real posters see correct nearby supply, and preventing geocoding api waste on test accounts.

-- 1. Redefine get_local_supply()
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
        -- Remote specific category match count
        SELECT count(*) INTO v_specific_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Exclude test profiles
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%' AND name <> 'HR'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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

        -- Remote general active tasker count (any skills)
        SELECT count(*) INTO v_general_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Exclude test profiles
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%' AND name <> 'HR'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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
        -- Physical specific category match count
        SELECT count(*) INTO v_specific_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Exclude test profiles
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%' AND name <> 'HR'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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

        -- Physical general active tasker count (any skills)
        SELECT count(*) INTO v_general_count
        FROM public.profiles
        WHERE role = 'tasker'
          AND is_online = true
          AND name IS NOT NULL AND name != 'New User' AND name != 'Guest User' AND name != ''
          -- Exclude test profiles
          AND name NOT ILIKE '%tester%' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%debug%' AND name <> 'HR'
          AND email NOT ILIKE '%tester%' AND email NOT ILIKE '%test%' AND email NOT ILIKE '%debug%'
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

    -- Return supply count based on two conditions:
    -- 1. At least 1 tasker matching the category
    -- 2. OR at least 2 taskers in the area overall
    IF v_specific_count >= 1 THEN
        RETURN v_specific_count;
    ELSIF v_general_count >= 2 THEN
        RETURN v_general_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Redefine get_unresolved_city_locations()
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
  -- Taskers with null city (excluding test/E2E profiles)
  SELECT p.id, 'tasker'::TEXT, ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng
  FROM public.profiles p
  WHERE p.city IS NULL 
    AND p.location IS NOT NULL
    AND (p.role = 'tasker' OR (p.skills IS NOT NULL AND cardinality(p.skills) > 0) OR p.upi_id IS NOT NULL)
    AND NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%')
    
  UNION ALL
  
  -- Addresses with null city (excluding addresses of test/E2E profiles)
  SELECT ua.id, 'address'::TEXT, ST_Y(ua.coordinates::geometry) as lat, ST_X(ua.coordinates::geometry) as lng
  FROM public.user_addresses ua
  LEFT JOIN public.profiles p ON p.id = ua.user_id
  WHERE ua.city IS NULL
    AND (p.id IS NULL OR NOT (p.name ILIKE 'tester%' OR p.name ILIKE 'e2e%' OR p.email ILIKE 'tester%' OR p.email ILIKE 'e2e%'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
