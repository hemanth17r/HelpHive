-- Migration: Create Help Reports Table
-- Allows users to submit support tickets securely.

CREATE TABLE IF NOT EXISTS public.help_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_help_reports_status ON public.help_reports(status);
CREATE INDEX IF NOT EXISTS idx_help_reports_user_id ON public.help_reports(user_id);

-- Enable RLS
ALTER TABLE public.help_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own reports (or anonymous if user_id is null)
CREATE POLICY "Anyone can insert help reports"
ON public.help_reports FOR INSERT
WITH CHECK (
    -- If user is logged in, they can only submit for themselves. 
    -- If not logged in, user_id is null, allowing anonymous submissions.
    (auth.uid() = user_id) OR (user_id IS NULL)
);

-- Policy: Users can view only their own reports
CREATE POLICY "Users can view own help reports"
ON public.help_reports FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view/update all (assuming admin logic exists in your app, else handled via dashboard)
