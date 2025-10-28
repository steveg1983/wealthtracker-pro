-- Migration: Update categories RLS to support service role + test harness
-- Description:
--   * Drops legacy policies that relied on app.current_user_id (no longer set)
--   * Adds explicit service-role bypass for CI/service usage
--   * Adds authenticated user guard using auth.uid()
--   * Adds optional test harness policy controlled via session setting

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Remove prior policies so we can redefine them
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can create own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
DROP POLICY IF EXISTS "Service role full access" ON public.categories;
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
DROP POLICY IF EXISTS "Test harness categories" ON public.categories;

-- Service role should bypass RLS (covers Supabase CI + backend cron jobs)
CREATE POLICY "Service role full access" ON public.categories
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can manage their own categories via auth.uid()
CREATE POLICY "Users manage own categories" ON public.categories
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- Test harness (anon key) may set app.test_user_id session variable before inserts
CREATE POLICY "Test harness categories" ON public.categories
  USING (
    current_setting('app.test_user_id', true) IS NOT NULL
    AND current_setting('app.test_user_id', true) = user_id::text
  )
  WITH CHECK (
    current_setting('app.test_user_id', true) IS NOT NULL
    AND current_setting('app.test_user_id', true) = user_id::text
  );

-- Optional: ensure policy order deterministic (newest evaluated last)
ALTER POLICY "Service role full access" ON public.categories
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

