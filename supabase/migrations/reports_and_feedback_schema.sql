-- Migration: Create Reports and Feedback Reputation Badges tables
-- This sets up the backend schema for a conflict-free reputation system
-- where negative feedback is kept private for admin moderation.

-- 1. Reports Table (Private Feedback)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID, -- Optional: link to a specific job if applicable
    category TEXT NOT NULL, -- e.g., 'Unsafe Environment', 'Rude or Unprofessional', 'Payment Issue', 'Other'
    details TEXT, -- Optional detailed description
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin dashboard querying
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 2. Reputation Badges Table (Public Positive Signals)
CREATE TABLE IF NOT EXISTS public.reputation_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    giver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID,
    badge_type TEXT NOT NULL, -- e.g., 'paid_promptly', 'reliable', 'clear_instructions', 'on_time'
    role_context TEXT NOT NULL, -- 'poster' or 'tasker'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient profile loading
CREATE INDEX IF NOT EXISTS idx_reputation_receiver ON public.reputation_badges(receiver_id);
CREATE INDEX IF NOT EXISTS idx_reputation_role ON public.reputation_badges(receiver_id, role_context);

-- 3. Feedbacks Table (Ratings)
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    giver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    role_context TEXT NOT NULL, -- 'poster' or 'tasker'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for calculating average ratings quickly
CREATE INDEX IF NOT EXISTS idx_feedbacks_receiver ON public.feedbacks(receiver_id, role_context);

-- Set up Row Level Security (RLS) for Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own reports
CREATE POLICY "Users can insert own reports" 
ON public.reports FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

-- Only admins can select/read reports (assuming an admin role or claim exists, adjusting to your auth setup)
-- CREATE POLICY "Admins can view reports" ON public.reports FOR SELECT USING (is_admin(auth.uid()));

-- RLS for Badges
ALTER TABLE public.reputation_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can view badges
CREATE POLICY "Badges are public" 
ON public.reputation_badges FOR SELECT 
USING (true);

-- Users can only insert badges they give
CREATE POLICY "Users can insert given badges" 
ON public.reputation_badges FOR INSERT 
WITH CHECK (auth.uid() = giver_id);

-- RLS for Feedbacks (Ratings)
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Anyone can view ratings
CREATE POLICY "Feedbacks are public" 
ON public.feedbacks FOR SELECT 
USING (true);

-- Users can only insert ratings they give
CREATE POLICY "Users can insert given feedbacks" 
ON public.feedbacks FOR INSERT 
WITH CHECK (auth.uid() = giver_id);
