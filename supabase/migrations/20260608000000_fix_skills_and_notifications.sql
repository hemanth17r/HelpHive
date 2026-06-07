-- Fix 1: Add missing skills column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

-- Fix 2: HelpHive uses custom authentication (phone OTP + local storage).
-- Since it does not use Supabase Auth sessions, auth.uid() and auth.role() = 'authenticated' will fail.
-- We must drop the previous RLS policies that rely on auth.uid() and allow anonymous access for the MVP.

-- Drop old policies for push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;

-- Add new policy for push_subscriptions to allow access
CREATE POLICY "Allow anon to manage push subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- Drop old policies for notifications
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (e.g. mark as read)" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;

-- Add new policy for notifications to allow access
CREATE POLICY "Allow anon to manage notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
