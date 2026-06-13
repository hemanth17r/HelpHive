-- Enable Row Level Security on hirer_waitlists
ALTER TABLE public.hirer_waitlists ENABLE ROW LEVEL SECURITY;

-- Create Select policy: Users can only view their own waitlist entries
CREATE POLICY "Users can view their own waitlist entries"
ON public.hirer_waitlists
FOR SELECT
USING (poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- Create Insert policy: Users can only insert their own waitlist entries
CREATE POLICY "Users can insert their own waitlist entries"
ON public.hirer_waitlists
FOR INSERT
WITH CHECK (poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- Create Delete policy: Users can only delete their own waitlist entries
CREATE POLICY "Users can delete their own waitlist entries"
ON public.hirer_waitlists
FOR DELETE
USING (poster_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

-- Re-create join_waitlist RPC to enforce caller authorization check
CREATE OR REPLACE FUNCTION public.join_waitlist(p_poster_id UUID, p_category_id VARCHAR, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
DECLARE
    v_target_location GEOGRAPHY(POINT);
BEGIN
    -- Security Check: Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to join the waitlist.';
    END IF;

    -- Security Check: Ensure poster_id matches the authenticated user's profile ID
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_poster_id AND auth_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Cannot join waitlist on behalf of another user.';
    END IF;

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
