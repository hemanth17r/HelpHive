-- 20260613200000_secure_configurations.sql
-- Enable Row Level Security and create policies for public configuration/lookup tables

-- 1. Enable RLS
ALTER TABLE public.marketplace_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (just to ensure idempotence)
DROP POLICY IF EXISTS "Allow public read access" ON public.marketplace_configurations;
DROP POLICY IF EXISTS "Allow admin all access" ON public.marketplace_configurations;

DROP POLICY IF EXISTS "Allow public read access" ON public.matching_behaviors;
DROP POLICY IF EXISTS "Allow admin all access" ON public.matching_behaviors;

DROP POLICY IF EXISTS "Allow public read access" ON public.category_groups;
DROP POLICY IF EXISTS "Allow admin all access" ON public.category_groups;

DROP POLICY IF EXISTS "Allow public read access" ON public.job_categories;
DROP POLICY IF EXISTS "Allow admin all access" ON public.job_categories;

-- 3. Create SELECT policies allowing public read-only access (anonymous or authenticated)
CREATE POLICY "Allow public read access" ON public.marketplace_configurations FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.matching_behaviors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.category_groups FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.job_categories FOR SELECT USING (true);

-- 4. Create write/modification policies restricting access to authenticated users who are administrators
CREATE POLICY "Allow admin all access" ON public.marketplace_configurations FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE auth_id = auth.uid()) = true);

CREATE POLICY "Allow admin all access" ON public.matching_behaviors FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE auth_id = auth.uid()) = true);

CREATE POLICY "Allow admin all access" ON public.category_groups FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE auth_id = auth.uid()) = true);

CREATE POLICY "Allow admin all access" ON public.job_categories FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE auth_id = auth.uid()) = true);
