-- =============================================================================
-- Migration: 20260901000000_specific_skills_relational_hierarchy.sql
-- Description: Establishes the locked 4-tier relational specific_skills table
-- and aligns dispatch_job_wave and get_local_supply to enforce granular matching.
-- =============================================================================

-- 1. Fix queue_standing category_group_id to On-site Services if null
UPDATE public.job_categories
SET category_group_id = (SELECT id FROM public.category_groups WHERE name = 'On-site Services' LIMIT 1)
WHERE id = 'queue_standing' AND category_group_id IS NULL;

-- 2. Create the locked specific_skills reference table
CREATE TABLE IF NOT EXISTS public.specific_skills (
    id VARCHAR(100) PRIMARY KEY,
    parent_category_id VARCHAR(100) NOT NULL REFERENCES public.job_categories(id) ON UPDATE CASCADE,
    discipline_id VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    skill_type VARCHAR(20) NOT NULL CHECK (skill_type IN ('physical', 'remote')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and public read policy
ALTER TABLE public.specific_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.specific_skills;
CREATE POLICY "Allow public read access" ON public.specific_skills FOR SELECT USING (true);

-- 3. Seed all 30 specific skills with strict parent category foreign keys
INSERT INTO public.specific_skills (id, parent_category_id, discipline_id, label, skill_type) VALUES
  -- Physical: Culinary
  ('feast_chef', 'local_helpers', 'culinary', 'Camp Chef & Feast Master', 'physical'),
  ('refreshment_artisan', 'events', 'culinary', 'Artisan Juice & Mocktail Alchemist', 'physical'),
  ('bake_artisan', 'creative', 'culinary', 'Bake & Dessert Artisan', 'physical'),

  -- Physical: Adventure & Escort
  ('trip_pilot', 'errands', 'adventure', 'Trip Pilot & Road Escort', 'physical'),
  ('trail_guide', 'personal_assistance', 'adventure', 'Trail Guide & Trek Leader', 'physical'),
  ('guardian_escort', 'personal_assistance', 'adventure', 'Guardian Escort & Mobility Shield', 'physical'),
  ('pet_ranger', 'others_physical', 'adventure', 'Pet Ranger & Animal Whisperer', 'physical'),

  -- Physical: Creative Ops
  ('drone_aviator', 'creative', 'creative_ops', 'Drone Aviator & Aerial Cam', 'physical'),
  ('gimbal_cameraman', 'creative', 'creative_ops', 'Gimbal Cameraman & Street Filmer', 'physical'),
  ('live_sound_dj', 'events', 'creative_ops', 'Live Sound & Party DJ', 'physical'),

  -- Physical: Titan Muscle
  ('titan_muscle', 'moving', 'titan_muscle', 'Titan Muscle & Heavy Shifts', 'physical'),
  ('modular_assembly', 'local_helpers', 'titan_muscle', 'Modular Craft & Flatpack Builder', 'physical'),
  ('base_handyman', 'local_helpers', 'titan_muscle', 'Base Repair & Handyman Ops', 'physical'),
  ('groundskeeper', 'local_helpers', 'titan_muscle', 'Groundskeeper & Terrain Clear', 'physical'),

  -- Physical: Urban Recon
  ('queue_proxy', 'queue_standing', 'urban_recon', 'Queue Recon & Priority Proxy', 'physical'),
  ('velocity_courier', 'errands', 'urban_recon', 'Velocity Sprint & Courier', 'physical'),
  ('supply_scout', 'errands', 'urban_recon', 'Market Scout & Supply Proxy', 'physical'),
  ('custom_physical_op', 'others_physical', 'urban_recon', 'Custom Physical Bounty & Special Op', 'physical'),

  -- Physical: Event Squad
  ('event_strike_squad', 'events', 'event_crew', 'Event Squad & Strike Teardown', 'physical'),
  ('hype_host', 'events', 'event_crew', 'Hype Emcee & Crowd Host', 'physical'),
  ('flash_decorator', 'events', 'event_crew', 'Flash Stylist & Decor Alchemist', 'physical'),

  -- Remote: Creative Ops
  ('reels_editor', 'video_editing', 'creative_ops', 'Reels Editor & Short-Form Alchemist', 'remote'),
  ('visual_artist', 'graphic_design', 'creative_ops', 'Visual Artist & Thumbnail Designer', 'remote'),

  -- Remote: Cyber Alchemy
  ('code_hotfix', 'tech_support', 'cyber_alchemy', 'Code Slayer & Web Hotfix', 'remote'),
  ('sheet_wizard', 'tech_support', 'cyber_alchemy', 'Automation Mage & Sheet Wizard', 'remote'),
  ('pc_tactician', 'tech_support', 'cyber_alchemy', 'Hardware Tactician & PC Builder', 'remote'),
  ('gaming_coach', 'others_remote', 'cyber_alchemy', 'Esports Coach & Squad Carry', 'remote'),

  -- Remote: Intel Lore
  ('hook_wordsmith', 'writing_translation', 'intel_lore', 'Hook Copywriter & Wordsmith', 'remote'),
  ('linguistic_oracle', 'writing_translation', 'intel_lore', 'Linguistic Oracle & Regional Voice', 'remote'),
  ('intel_scout', 'others_remote', 'intel_lore', 'Deep Intel & Market Scout', 'remote'),
  ('custom_remote_op', 'others_remote', 'intel_lore', 'Custom Remote Bounty & Special Op', 'remote')
ON CONFLICT (id) DO UPDATE SET
  parent_category_id = EXCLUDED.parent_category_id,
  discipline_id = EXCLUDED.discipline_id,
  label = EXCLUDED.label,
  skill_type = EXCLUDED.skill_type;

-- 4. Upgrade dispatch_job_wave with Relational Hierarchy Resolution
CREATE OR REPLACE FUNCTION public.dispatch_job_wave(p_job_id UUID, p_wave_number INT)
RETURNS INTEGER AS $$
DECLARE
    v_job RECORD;
    v_behavior RECORD;
    v_target_location GEOGRAPHY(POINT);
    v_radius_m INTEGER;
    v_stage VARCHAR;
    v_tasker_record RECORD;
    v_offers_created INTEGER := 0;
    
    -- Active pool parameters
    v_pool_config JSONB;
    v_growth_days INTEGER;
    v_mature_hours INTEGER;
    v_tasker_radius INTEGER;
    
    -- Sequential dispatch parameters
    v_target_active INTEGER;
    v_active_offers INTEGER;
    v_needed_offers INTEGER;
    v_accepted_offers INTEGER;
    v_remaining_needed INTEGER;
    
    -- Expiration parameters
    v_expires_interval INTERVAL;
    
    -- Density & fallback matching parameters
    v_exact_match_count INTEGER := 0;
    v_resolved_category_id VARCHAR;
BEGIN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
    END IF;

    -- Resolve parent category: Look up via specific_skills first, fallback to job.skill_id
    IF v_job.specific_skill_id IS NOT NULL THEN
        SELECT parent_category_id INTO v_resolved_category_id 
        FROM public.specific_skills 
        WHERE id = v_job.specific_skill_id;
    END IF;

    IF v_resolved_category_id IS NULL THEN
        v_resolved_category_id := v_job.skill_id;
    END IF;

    -- Get matching behavior via the relational hierarchy
    SELECT mb.* INTO v_behavior
    FROM public.matching_behaviors mb
    JOIN public.category_groups cg ON cg.matching_behavior_id = mb.id
    JOIN public.job_categories jc ON jc.category_group_id = cg.id
    WHERE jc.id = v_resolved_category_id;

    IF NOT FOUND THEN
        SELECT * INTO v_behavior FROM public.matching_behaviors WHERE name = 'on_location' LIMIT 1;
    END IF;

    -- Determine center location
    IF v_behavior.location_strategy = 'primary_location' THEN
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    ELSIF v_behavior.location_strategy = 'secondary_location' THEN
        v_target_location := COALESCE(v_job.secondary_location, v_job.primary_location, v_job.location);
    ELSE
        v_target_location := COALESCE(v_job.primary_location, v_job.location);
    END IF;

    -- Determine radius based on wave number
    IF p_wave_number = 1 THEN v_radius_m := v_behavior.wave1_radius_m;
    ELSIF p_wave_number = 2 THEN v_radius_m := v_behavior.wave2_radius_m;
    ELSE v_radius_m := v_behavior.wave3_radius_m;
    END IF;

    -- Get marketplace stage and pool configurations
    v_stage := public.get_marketplace_stage(v_resolved_category_id, ST_Y(v_target_location::geometry), ST_X(v_target_location::geometry), 20000);
    
    SELECT value INTO v_pool_config FROM public.marketplace_configurations WHERE key = 'active_pool_rules';
    v_growth_days := COALESCE((v_pool_config->>'growth_active_days')::INTEGER, 7);
    v_mature_hours := COALESCE((v_pool_config->>'mature_active_hours')::INTEGER, 24);

    -- Calculate remaining helpers needed
    SELECT count(*) INTO v_accepted_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'accepted';

    v_remaining_needed := COALESCE(v_job.people_needed, 1) - v_accepted_offers;
    IF v_remaining_needed <= 0 THEN
        RETURN 0;
    END IF;

    v_expires_interval := interval '90 seconds';

    -- Target active offers based on stage and remaining helpers needed
    IF v_stage = 'bootstrap' THEN
        v_target_active := 10 * p_wave_number * v_remaining_needed;
    ELSIF v_stage = 'growth' THEN
        v_target_active := 5 * p_wave_number * v_remaining_needed;
    ELSE
        v_target_active := 3 * p_wave_number * v_remaining_needed;
    END IF;

    -- Count active pending offers for this job
    SELECT count(*) INTO v_active_offers
    FROM public.job_offers
    WHERE job_id = p_job_id AND status = 'pending';

    v_needed_offers := v_target_active - v_active_offers;
    IF v_needed_offers <= 0 THEN
        RETURN 0;
    END IF;

    -- Count online exact matches (checks specific_skill_id first, then category_id)
    SELECT count(*) INTO v_exact_match_count
    FROM public.profiles p
    WHERE p.role = 'tasker'
      AND p.is_online = true
      AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
      AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
      AND p.upi_id IS NOT NULL AND p.upi_id != ''
      AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
      AND p.location IS NOT NULL
      AND (
          (v_job.specific_skill_id IS NOT NULL AND v_job.specific_skill_id = ANY(p.skills))
          OR
          (v_resolved_category_id = ANY(p.skills))
      )
      AND p.id != v_job.poster_id
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id AND jo.status IN ('pending', 'accepted', 'rejected'))
      AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
      AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
      AND (
          v_behavior.location_strategy = 'remote'
          OR (
              ST_DWithin(v_target_location, p.location, COALESCE(p.coverage_radius, 5000))
              AND ST_DWithin(v_target_location, p.location, v_radius_m)
              AND ST_DWithin(v_target_location, p.location, 50000)
          )
      );

    -- Loop through eligible taskers with density-aware ranking
    FOR v_tasker_record IN
        SELECT p.id, p.location, p.coverage_radius, p.last_active_at, p.is_online, p.reliability_score, p.skill_matrix
        FROM public.profiles p
        WHERE p.role = 'tasker'
          AND p.is_online = true
          AND p.name IS NOT NULL AND p.name != 'New User' AND p.name != 'Guest User' AND p.name != ''
          AND p.phone IS NOT NULL AND p.phone != 'Add Phone' AND p.phone != ''
          AND p.upi_id IS NOT NULL AND p.upi_id != ''
          AND p.skills IS NOT NULL AND cardinality(p.skills) > 0
          AND p.location IS NOT NULL
          AND (
              (v_job.specific_skill_id IS NOT NULL AND v_job.specific_skill_id = ANY(p.skills))
              OR
              (v_resolved_category_id = ANY(p.skills))
              OR
              (p_wave_number > 1)
              OR
              (v_exact_match_count <= 3) -- Low Density Fallback
          )
          AND p.id != v_job.poster_id
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.job_id = p_job_id AND jo.tasker_id = p.id AND jo.status IN ('pending', 'accepted', 'rejected'))
          AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.tasker_id = p.id AND j.v2_status IN ('accepted', 'en_route_to_primary', 'in_progress'))
          AND NOT EXISTS (SELECT 1 FROM public.job_offers jo JOIN public.jobs j ON j.id = jo.job_id WHERE jo.tasker_id = p.id AND jo.status = 'accepted' AND j.v2_status IN ('searching', 'accepted', 'en_route_to_primary', 'in_progress'))
        ORDER BY 
          -- 1. Exact Skill Match Priority (Specific skill first, then category)
          (CASE 
             WHEN v_job.specific_skill_id IS NOT NULL AND v_job.specific_skill_id = ANY(p.skills) THEN 2
             WHEN v_resolved_category_id = ANY(p.skills) THEN 1
             ELSE 0 
           END) DESC,

          -- 2. Domain Rating from Skill Matrix
          CASE WHEN (v_stage = 'mature' OR v_exact_match_count >= 10) THEN
            COALESCE(
              (p.skill_matrix->COALESCE(v_job.specific_skill_id, v_resolved_category_id)->>'rating')::numeric,
              (p.skill_matrix->v_resolved_category_id->>'rating')::numeric,
              COALESCE(p.rating, 5.0)
            )
          ELSE 0 END DESC,

          -- 3. Reliability Score
          CASE WHEN (v_stage IN ('growth', 'mature') OR v_exact_match_count >= 4) THEN
            COALESCE(p.reliability_score, 100.0)
          ELSE 0 END DESC,

          -- 4. Spatial Proximity
          p.location <-> v_target_location ASC
    LOOP
        v_tasker_radius := COALESCE(v_tasker_record.coverage_radius, 5000);

        -- Spatial range check
        IF v_behavior.location_strategy != 'remote' THEN
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_tasker_radius) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) OR
               NOT ST_DWithin(v_target_location, v_tasker_record.location, 50000) THEN
                CONTINUE;
            END IF;
        ELSE
            IF NOT ST_DWithin(v_target_location, v_tasker_record.location, v_radius_m) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Stage-aware active pool rules
        IF v_stage = 'growth' THEN
            IF v_tasker_record.last_active_at < (now() - (v_growth_days || ' days')::interval) THEN
                CONTINUE;
            END IF;
        ELSIF v_stage = 'mature' THEN
            IF v_tasker_record.last_active_at < (now() - (v_mature_hours || ' hours')::interval) THEN
                CONTINUE;
            END IF;
        END IF;

        -- Dispatch the offer
        INSERT INTO public.job_offers (
            job_id, tasker_id, status, amount_offered, wave_number, expires_at
        ) VALUES (
            p_job_id, v_tasker_record.id, 'pending', v_job.amount, p_wave_number, now() + v_expires_interval
        );
        
        v_offers_created := v_offers_created + 1;
        EXIT WHEN v_offers_created >= v_needed_offers;
    END LOOP;

    UPDATE public.jobs 
    SET max_wave_dispatched = p_wave_number 
    WHERE id = p_job_id;

    RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;