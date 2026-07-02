-- Phase 1.1: Database Foundation (V2)
-- Safely additive migration. Strict RLS on new tables.

-- 1. ENUMs
DO $$ BEGIN
    CREATE TYPE offer_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status_enum AS ENUM ('draft', 'searching', 'accepted', 'en_route_to_primary', 'in_progress', 'completed', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. New Foundation Tables

-- user_addresses
CREATE TABLE IF NOT EXISTS public.user_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    label VARCHAR(50),
    formatted_address TEXT NOT NULL,
    landmark VARCHAR(255),
    coordinates GEOGRAPHY(POINT) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    last_used_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- job_offers
CREATE TABLE IF NOT EXISTS public.job_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    tasker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status offer_status_enum DEFAULT 'pending',
    amount_offered DECIMAL NOT NULL,
    wave_number INTEGER DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(job_id, tasker_id)
);

-- 3. Additive Columns to Existing Tables (Safely)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS primary_location GEOGRAPHY(POINT);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS secondary_location GEOGRAPHY(POINT);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS primary_address_id UUID REFERENCES public.user_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS secondary_address_id UUID REFERENCES public.user_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS primary_otp VARCHAR(4);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completion_otp VARCHAR(4);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tasker_current_location GEOGRAPHY(POINT);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tasker_location_updated_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS v2_status job_status_enum;

-- 4. Strict RLS for New Tables (Default Deny/Auth UID)
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.user_addresses;
CREATE POLICY "Users can manage their own addresses" 
    ON public.user_addresses 
    FOR ALL 
    USING (auth.uid() = user_id);

ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Taskers can view their own offers" ON public.job_offers;
CREATE POLICY "Taskers can view their own offers" 
    ON public.job_offers 
    FOR SELECT 
    USING (auth.uid() = tasker_id);

-- 5. Indexes (Future-Proofing)
CREATE INDEX IF NOT EXISTS idx_jobs_primary_loc ON public.jobs USING GIST (primary_location);
CREATE INDEX IF NOT EXISTS idx_jobs_secondary_loc ON public.jobs USING GIST (secondary_location);
CREATE INDEX IF NOT EXISTS idx_user_addresses_coords ON public.user_addresses USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS idx_job_offers_job_id ON public.job_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_tasker_id ON public.job_offers(tasker_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);
