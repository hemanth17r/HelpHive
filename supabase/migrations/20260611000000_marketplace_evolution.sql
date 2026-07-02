-- Add service area properties to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coverage_radius INTEGER DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coverage_level VARCHAR(20) DEFAULT 'nearby';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service_area_name VARCHAR(255);

-- Create waitlists table
CREATE TABLE IF NOT EXISTS public.hirer_waitlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for geospatial querying on waitlists
CREATE INDEX IF NOT EXISTS idx_hirer_waitlists_location ON public.hirer_waitlists USING GIST(location);

-- Create RPC to get local supply count
CREATE OR REPLACE FUNCTION public.get_local_supply(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_target_location GEOGRAPHY(POINT);
BEGIN
    v_target_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE role = 'tasker'
      AND p_category_id = ANY(skills)
      AND ST_DWithin(location, v_target_location, COALESCE(coverage_radius, p_radius_meters));

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC to join waitlist
CREATE OR REPLACE FUNCTION public.join_waitlist(p_poster_id UUID, p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
DECLARE
    v_target_location GEOGRAPHY(POINT);
BEGIN
    v_target_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    
    -- Check if already waitlisted for this category in this general area (e.g., within 1km) to avoid duplicates
    IF EXISTS (
        SELECT 1 FROM public.hirer_waitlists 
        WHERE poster_id = p_poster_id 
          AND category_id = p_category_id 
          AND ST_DWithin(location, v_target_location, 1000)
    ) THEN
        RETURN TRUE; -- Already waitlisted
    END IF;

    INSERT INTO public.hirer_waitlists (poster_id, category_id, location)
    VALUES (p_poster_id, p_category_id, v_target_location);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC to get waitlist count in area
CREATE OR REPLACE FUNCTION public.get_waitlist_count(p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_meters INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_target_location GEOGRAPHY(POINT);
BEGIN
    v_target_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    SELECT count(*) INTO v_count
    FROM public.hirer_waitlists
    WHERE category_id = p_category_id
      AND ST_DWithin(location, v_target_location, p_radius_meters);

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
