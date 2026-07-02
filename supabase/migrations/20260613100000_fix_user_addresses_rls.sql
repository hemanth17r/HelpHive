-- =============================================================================
-- HelpHive: Fix user_addresses RLS Policy
--
-- The user_addresses table was created with an auth.uid()-based RLS policy,
-- but HelpHive uses custom phone auth (no Supabase Auth session), so auth.uid()
-- is always NULL. This caused all INSERT/SELECT/UPDATE/DELETE on user_addresses
-- to be silently blocked, preventing job locations from being saved to the DB.
--
-- This migration replaces the restrictive policy with the same anon-safe pattern
-- used by all other HelpHive tables (profiles, jobs, feedbacks, etc.).
-- =============================================================================

-- Drop the broken auth.uid() policy
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.user_addresses;

-- Also drop job_offers policy if it uses auth.uid() (same table in same migration)
DROP POLICY IF EXISTS "Taskers can view their own offers" ON public.job_offers;

-- Allow anon access (custom phone auth — no Supabase Auth session)
CREATE POLICY "Allow anon to manage user_addresses" ON public.user_addresses
  FOR ALL USING (true) WITH CHECK (true);

-- Restore job_offers with anon-safe policy
CREATE POLICY "Allow anon to manage job_offers" ON public.job_offers
  FOR ALL USING (true) WITH CHECK (true);
