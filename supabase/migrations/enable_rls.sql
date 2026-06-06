-- Enable RLS on waitlist table
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Add a default policy for waitlist to prevent unauthorized access
-- (Adjust the policy as needed for your application's logic)
CREATE POLICY "Allow authenticated users to insert into waitlist" 
ON public.waitlist FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Enable RLS on user_locations table
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Add a default policy for user_locations
CREATE POLICY "Users can manage their own locations" 
ON public.user_locations FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
