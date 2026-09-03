-- =============================================================================
-- HelpHive: Game Mode Schema Alignment & Unified Player Dossier Foundation
-- Migration: 20260830000000_game_mode_schema_alignment.sql
-- 
-- 1. Adds gamification & multi-currency columns to public.jobs:
--    - currency (e.g. 'INR', 'USD', 'EUR', 'GBP')
--    - quest_rarity ('standard', 'legendary', 'volunteer')
--    - specific_skill_id (granular skill loadout identifier)
--    - xp_reward (bounty experience points)
--
-- 2. Adds unified player progression columns to public.profiles:
--    - currency (preferred user currency)
--    - xp (accumulated player XP)
--    - player_level (current gamer level)
--    - handle (e.g. '@operative')
--    - title (e.g. 'Rookie Scout', 'Apex Hunter')
--    - streak_days (consecutive quest streak)
--
-- 3. Automatic XP Awarding Trigger on Job Completion
-- =============================================================================

-- 1. Safely add columns to public.jobs
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS quest_rarity VARCHAR(30) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS specific_skill_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 50;

CREATE INDEX IF NOT EXISTS idx_jobs_quest_rarity ON public.jobs(quest_rarity);
CREATE INDEX IF NOT EXISTS idx_jobs_currency ON public.jobs(currency);
CREATE INDEX IF NOT EXISTS idx_jobs_specific_skill_id ON public.jobs(specific_skill_id);

-- 2. Safely add columns to public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS title VARCHAR(100) DEFAULT 'Rookie Scout',
  ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_player_level ON public.profiles(player_level);
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);

-- 3. XP Awarding Stored Function on Job Completion
CREATE OR REPLACE FUNCTION public.handle_job_completion_xp()
RETURNS TRIGGER AS $$
DECLARE
  v_tasker_id UUID;
  v_xp_gain INTEGER;
BEGIN
  -- Trigger only when status transitions to completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    v_xp_gain := COALESCE(NEW.xp_reward, 50);

    -- If a specific tasker_id is assigned directly on the job
    IF NEW.tasker_id IS NOT NULL THEN
      UPDATE public.profiles
      SET 
        xp = COALESCE(xp, 0) + v_xp_gain,
        player_level = LEAST(99, GREATEST(1, FLOOR(SQRT((COALESCE(xp, 0) + v_xp_gain) / 25))::INTEGER + 1)),
        total_completed_jobs = COALESCE(total_completed_jobs, 0) + 1,
        total_tasks_completed_count = COALESCE(total_tasks_completed_count, 0) + 1
      WHERE id = NEW.tasker_id;
    END IF;

    -- Also award XP to any accepted crew members in job_offers
    UPDATE public.profiles p
    SET 
      xp = COALESCE(p.xp, 0) + v_xp_gain,
      player_level = LEAST(99, GREATEST(1, FLOOR(SQRT((COALESCE(p.xp, 0) + v_xp_gain) / 25))::INTEGER + 1)),
      total_completed_jobs = COALESCE(p.total_completed_jobs, 0) + 1,
      total_tasks_completed_count = COALESCE(p.total_tasks_completed_count, 0) + 1
    FROM public.job_offers jo
    WHERE jo.job_id = NEW.id 
      AND jo.status = 'accepted'
      AND jo.tasker_id = p.id
      AND jo.tasker_id IS DISTINCT FROM NEW.tasker_id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_job_completion_xp ON public.jobs;
CREATE TRIGGER tr_handle_job_completion_xp
AFTER UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_job_completion_xp();
