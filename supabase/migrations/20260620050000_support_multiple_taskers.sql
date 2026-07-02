-- Migration: Support Multiple Taskers
-- Add RLS policy for reading user locations and auto-expire job offers on job cancellation

-- 1. SELECT policy on user_locations to allow poster to fetch coordinates of taskers
CREATE POLICY "User locations are viewable by everyone"
ON public.user_locations
FOR SELECT
USING (true);

-- 2. Trigger function to expire job offers when job status is set to cancelled
CREATE OR REPLACE FUNCTION public.handle_job_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled') OR 
       (NEW.v2_status = 'cancelled' AND OLD.v2_status IS DISTINCT FROM 'cancelled') THEN
        UPDATE public.job_offers
        SET status = 'expired'
        WHERE job_id = NEW.id AND status IN ('pending', 'accepted');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind trigger function to jobs table
CREATE OR REPLACE TRIGGER tr_job_cancelled
AFTER UPDATE OF status, v2_status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_job_cancellation();
