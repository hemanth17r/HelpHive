-- =============================================================================
-- HelpHive Analytics & Admin Dashboard Migration
-- 
-- Creates:
-- 1. app_events table for event tracking (no FK to auth.users)
-- 2. is_admin flag on profiles
-- 3. RPC functions for dashboard analytics
-- 4. Sets initial admin user
-- =============================================================================

-- ─── 1. Create app_events table ────────────────────────────────────────────
-- NOTE: We intentionally do NOT reference auth.users(id) because HelpHive
-- uses custom phone-based auth, not Supabase Auth. user_id is a plain UUID
-- matching profiles.id.

CREATE TABLE IF NOT EXISTS public.app_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID,
    active_role TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient analytics queries
CREATE INDEX IF NOT EXISTS idx_app_events_type ON public.app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_user ON public.app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON public.app_events(created_at);
CREATE INDEX IF NOT EXISTS idx_app_events_type_created ON public.app_events(event_type, created_at);

-- RLS: Allow anon access (HelpHive uses custom auth, not Supabase Auth)
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon to manage app_events" ON public.app_events;
CREATE POLICY "Allow anon to manage app_events" ON public.app_events
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. Add admin flag to profiles ─────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- ─── 3. Set initial admin user ─────────────────────────────────────────────

UPDATE public.profiles SET is_admin = true WHERE phone = '9347442426';

-- ─── 4. Dashboard RPC Functions ────────────────────────────────────────────
-- These use SECURITY DEFINER to bypass RLS and return aggregate-only data.
-- Admin verification happens at the application layer before calling these.

-- 4a. Get summary stats for dashboard header cards
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_jobs', (SELECT COUNT(*) FROM public.jobs),
    'open_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'open'),
    'accepted_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'accepted'),
    'completed_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'completed'),
    'expired_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'expired'),
    'total_events', (SELECT COUNT(*) FROM public.app_events),
    'events_today', (SELECT COUNT(*) FROM public.app_events WHERE created_at >= CURRENT_DATE),
    'users_today', (SELECT COUNT(DISTINCT user_id) FROM public.app_events WHERE created_at >= CURRENT_DATE),
    'jobs_today', (SELECT COUNT(*) FROM public.jobs WHERE created_at >= CURRENT_DATE)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4b. Get event counts grouped by type for a date range
CREATE OR REPLACE FUNCTION public.get_event_counts(
  p_start_date TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(event_type TEXT, event_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT ae.event_type, COUNT(*)::BIGINT as event_count
  FROM public.app_events ae
  WHERE ae.created_at >= p_start_date AND ae.created_at <= p_end_date
  GROUP BY ae.event_type
  ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4c. Get daily event timeseries for charts
CREATE OR REPLACE FUNCTION public.get_daily_event_timeseries(
  p_event_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(day DATE, event_type TEXT, event_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(ae.created_at) as day,
    ae.event_type,
    COUNT(*)::BIGINT as event_count
  FROM public.app_events ae
  WHERE ae.created_at >= (now() - (p_days || ' days')::interval)
    AND (p_event_type IS NULL OR ae.event_type = p_event_type)
  GROUP BY DATE(ae.created_at), ae.event_type
  ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4d. Get recent events for activity feed
CREATE OR REPLACE FUNCTION public.get_recent_events(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  event_type TEXT,
  user_id UUID,
  active_role TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  user_name TEXT,
  user_phone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ae.id,
    ae.event_type,
    ae.user_id,
    ae.active_role,
    ae.entity_id,
    ae.metadata,
    ae.created_at,
    p.name as user_name,
    p.phone as user_phone
  FROM public.app_events ae
  LEFT JOIN public.profiles p ON ae.user_id = p.id
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
