-- Add upi_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
