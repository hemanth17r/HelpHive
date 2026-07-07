-- Decoupled completion & independent cancellation support
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS completed_by_tasker BOOLEAN DEFAULT FALSE;
