-- Migration: Create Application Events table for lightweight tracking
-- This provides a structured foundation for future analytics while remaining lean for MVP.

CREATE TABLE IF NOT EXISTS public.app_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL, -- e.g., 'task_creation', 'role_switch', 'login'
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Allow keeping events even if user deleted, or SET NULL
    active_role TEXT, -- 'tasker' or 'poster'
    entity_id UUID, -- Optional reference to related entity (job, report, etc.)
    metadata JSONB DEFAULT '{}'::jsonb, -- Lightweight context payload
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying by analytics dashboards later
CREATE INDEX IF NOT EXISTS idx_app_events_type ON public.app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_user ON public.app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON public.app_events(created_at);

-- Row Level Security (RLS)
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Service role (backend) or authenticated users can insert events
CREATE POLICY "Users can insert their own events"
ON public.app_events FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins/analytics services should be able to select events. 
-- For now, no public read access.
-- CREATE POLICY "Admins can view events" ON public.app_events FOR SELECT USING (is_admin(auth.uid()));
