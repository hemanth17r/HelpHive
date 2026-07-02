-- Add is_online column to profiles table, default to true
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true;
