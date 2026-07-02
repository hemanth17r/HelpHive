-- Add city column to profiles and user_addresses
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS city TEXT;

-- Create get_unresolved_city_locations() function
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
    
  UNION ALL
  
  -- Addresses with null city
  SELECT ua.id, 'address'::TEXT, ST_Y(ua.coordinates::geometry) as lat, ST_X(ua.coordinates::geometry) as lng
  FROM public.user_addresses ua
  WHERE ua.city IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_city_leaderboard() function
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
    GROUP BY COALESCE(p.city, 'Unknown')
  ),
  city_hirers AS (
    -- Group by the user's default address city (or first address city if no default)
    SELECT COALESCE(ua.city, 'Unknown') as city, COUNT(DISTINCT ua.user_id) as count
    FROM public.user_addresses ua
    WHERE ua.is_default = true OR ua.id IN (
      SELECT DISTINCT ON (user_id) id FROM public.user_addresses ORDER BY user_id, is_default DESC, created_at DESC
    )
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
