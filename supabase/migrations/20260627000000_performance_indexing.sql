-- Migration: Optimize dashboard stats and event breakdown metrics queries for high scale
-- 1. Index on jobs status and created_at
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at);

-- 2. Composite indexes on app_events for dashboard queries
CREATE INDEX IF NOT EXISTS idx_app_events_created_at_type ON public.app_events(created_at, event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at_user ON public.app_events(created_at, user_id);

-- 3. Index on help_reports created_at for dashboard lists
CREATE INDEX IF NOT EXISTS idx_help_reports_created_at ON public.help_reports(created_at DESC);
