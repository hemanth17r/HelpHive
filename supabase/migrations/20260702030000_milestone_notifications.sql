-- Migration: Milestone Notifications
-- When total accounts, serious taskers, serious hirers, or city leaderboard counts hit a multiple of 50, notify the admin.

CREATE OR REPLACE FUNCTION public.check_milestones_and_notify_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_total_accounts BIGINT;
  v_serious_taskers BIGINT;
  v_serious_hirers BIGINT;
  v_city TEXT;
  v_city_taskers BIGINT;
  v_city_hirers BIGINT;
  v_body TEXT;
BEGIN
  -- 1. Find the admin profile
  SELECT id INTO v_admin_id 
  FROM public.profiles 
  WHERE phone = '9347442426' OR is_admin = true 
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 2. Count Total Accounts
  SELECT COUNT(*) INTO v_total_accounts FROM public.profiles;
  IF v_total_accounts % 50 = 0 AND v_total_accounts > 0 THEN
    v_body := 'You hit ' || v_total_accounts || ' total. Accounts.';
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = v_admin_id 
        AND type = 'admin_alert' 
        AND body = v_body
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, action_url)
      VALUES (v_admin_id, 'admin_alert', 'Milestone Hit', v_body, '/admin');
    END IF;
  END IF;

  -- 3. Count Serious Taskers
  SELECT COUNT(DISTINCT p.id) INTO v_serious_taskers 
  FROM public.profiles p
  WHERE p.location IS NOT NULL
    AND p.upi_id IS NOT NULL 
    AND p.upi_id != ''
    AND p.skills IS NOT NULL 
    AND cardinality(p.skills) > 0;
    
  IF v_serious_taskers % 50 = 0 AND v_serious_taskers > 0 THEN
    v_body := 'You hit ' || v_serious_taskers || ' total. Serious Tasker''s.';
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = v_admin_id 
        AND type = 'admin_alert' 
        AND body = v_body
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, action_url)
      VALUES (v_admin_id, 'admin_alert', 'Milestone Hit', v_body, '/admin');
    END IF;
  END IF;

  -- 4. Count Serious Hirers
  SELECT COUNT(DISTINCT p.id) INTO v_serious_hirers 
  FROM public.profiles p
  WHERE p.name IS NOT NULL 
    AND p.name != 'New User' 
    AND p.name != 'Guest User' 
    AND p.name != ''
    AND EXISTS (
        SELECT 1 FROM public.user_addresses ua
        WHERE ua.user_id = p.id
    );
    
  IF v_serious_hirers % 50 = 0 AND v_serious_hirers > 0 THEN
    v_body := 'You hit ' || v_serious_hirers || ' total. Serious Hire''s.';
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = v_admin_id 
        AND type = 'admin_alert' 
        AND body = v_body
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, action_url)
      VALUES (v_admin_id, 'admin_alert', 'Milestone Hit', v_body, '/admin');
    END IF;
  END IF;

  -- 5. City Leaderboard Milestones
  -- We query all distinct cities to make sure we check any city that has profiles or addresses
  FOR v_city IN 
    SELECT DISTINCT city_name FROM (
      SELECT COALESCE(p.city, 'Unknown') as city_name FROM public.profiles p WHERE p.city IS NOT NULL AND p.city != '' AND p.city != 'Unknown'
      UNION
      SELECT COALESCE(ua.city, 'Unknown') as city_name FROM public.user_addresses ua WHERE ua.city IS NOT NULL AND ua.city != '' AND ua.city != 'Unknown'
    ) as c
  LOOP
    -- Calculate tasker count for this city
    SELECT COUNT(DISTINCT p.id) INTO v_city_taskers 
    FROM public.profiles p
    WHERE COALESCE(p.city, 'Unknown') = v_city
      AND (p.role = 'tasker' OR (p.skills IS NOT NULL AND cardinality(p.skills) > 0) OR p.upi_id IS NOT NULL)
      AND p.location IS NOT NULL;

    -- Calculate hirer count for this city
    SELECT COUNT(DISTINCT ua.user_id) INTO v_city_hirers 
    FROM public.user_addresses ua
    WHERE COALESCE(ua.city, 'Unknown') = v_city
      AND (ua.is_default = true OR ua.id IN (
        SELECT DISTINCT ON (user_id) id FROM public.user_addresses ORDER BY user_id, is_default DESC, created_at DESC
      ));

    -- Check taskers milestone
    IF v_city_taskers % 50 = 0 AND v_city_taskers > 0 THEN
      v_body := 'You hit ' || v_city_taskers || ' Tasker''s in ' || v_city || '.';
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_admin_id 
          AND type = 'admin_alert' 
          AND body = v_body
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, action_url)
        VALUES (v_admin_id, 'admin_alert', 'City Milestone Hit', v_body, '/admin');
      END IF;
    END IF;

    -- Check hirers milestone
    IF v_city_hirers % 50 = 0 AND v_city_hirers > 0 THEN
      v_body := 'You hit ' || v_city_hirers || ' Hire''s in ' || v_city || '.';
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_admin_id 
          AND type = 'admin_alert' 
          AND body = v_body
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, action_url)
        VALUES (v_admin_id, 'admin_alert', 'City Milestone Hit', v_body, '/admin');
      END IF;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Binds triggers
DROP TRIGGER IF EXISTS tr_profile_milestones ON public.profiles;
CREATE TRIGGER tr_profile_milestones
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_milestones_and_notify_admin();

DROP TRIGGER IF EXISTS tr_address_milestones ON public.user_addresses;
CREATE TRIGGER tr_address_milestones
AFTER INSERT OR UPDATE OR DELETE ON public.user_addresses
FOR EACH ROW
EXECUTE FUNCTION public.check_milestones_and_notify_admin();
