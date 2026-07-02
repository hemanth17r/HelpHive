-- Migration: 20260630120000_infrastructure_audit_optimizations.sql
-- Optimizes skills-based searching and active tasker filtering queries for zero-downtime execution

-- 1. Create a GIN index on public.profiles(skills) array to speed up matching checks
CREATE INDEX IF NOT EXISTS idx_profiles_skills_gin 
  ON public.profiles USING gin (skills);

-- 2. Create a composite partial index on active online taskers for rapid dispatcher scans
CREATE INDEX IF NOT EXISTS idx_profiles_role_online 
  ON public.profiles(role, is_online) 
  WHERE role = 'tasker' AND is_online = true;
