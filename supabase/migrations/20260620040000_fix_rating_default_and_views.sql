-- Migration: Drop default rating of 5.0 for profiles
-- New users should not start with mock ratings.

-- 1. Alter public.profiles to set rating default to NULL
ALTER TABLE public.profiles ALTER COLUMN rating SET DEFAULT NULL;

-- 2. Update existing profiles with 0 tasks completed and 5.0 rating to have NULL rating
UPDATE public.profiles SET rating = NULL WHERE tasks_completed = 0 AND rating = 5.0;
