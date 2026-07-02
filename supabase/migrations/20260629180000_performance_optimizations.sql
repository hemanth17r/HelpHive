-- Migration: 20260629180000_performance_optimizations.sql
-- Optimizes high-frequency queries on feedbacks, notifications, and jobs tables

-- 1. Index on feedbacks(giver_id) to optimize feed fetching checks
CREATE INDEX IF NOT EXISTS idx_feedbacks_giver 
  ON public.feedbacks(giver_id);

-- 2. Composite index on notifications to speed up fetching user notifications by role
CREATE INDEX IF NOT EXISTS idx_notifications_user_role_created 
  ON public.notifications(user_id, role, created_at DESC);

-- 3. Partial index on jobs to optimize background wave dispatch scanning
CREATE INDEX IF NOT EXISTS idx_jobs_searching_open 
  ON public.jobs(status, v2_status) 
  WHERE status = 'open' AND v2_status = 'searching';
