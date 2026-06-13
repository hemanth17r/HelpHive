-- Prevent duplicate profiles for the same auth user.
-- The old code had no concurrency guard on onAuthStateChange, causing
-- INITIAL_SESSION and SIGNED_IN to race and create duplicate profiles.
-- This unique partial index prevents it at the DB level.

-- Step 1: Clean up any existing duplicates (keep earliest per auth_id)
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY auth_id ORDER BY created_at ASC) as rn
    FROM public.profiles
    WHERE auth_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Step 2: Add unique partial index on auth_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_auth_id_unique
  ON public.profiles (auth_id)
  WHERE auth_id IS NOT NULL;
