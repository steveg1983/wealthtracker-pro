-- Fix accounts RLS to allow anon key operations
--
-- The frontend Supabase client uses the anon key without a Supabase auth session
-- (app uses Clerk for auth, not Supabase Auth), so auth.uid() is always NULL.
-- The existing policy targets only "authenticated" role, blocking all frontend ops.
-- We need explicit policies for the anon role.
--
-- Precedent: same fix applied to transactions table in:
--   20260309_fix_transactions_rls_for_anon_reads.sql
--   20260310_fix_transactions_rls_for_anon_updates.sql

-- Drop the existing policy that only works for authenticated users
DROP POLICY IF EXISTS "Authenticated users can do everything with accounts" ON public.accounts;

-- Allow anon role to SELECT accounts (filtered by user_id at app level)
CREATE POLICY "Allow anon select on accounts"
  ON public.accounts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anon role to INSERT accounts
CREATE POLICY "Allow anon insert on accounts"
  ON public.accounts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon role to UPDATE accounts
CREATE POLICY "Allow anon update on accounts"
  ON public.accounts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon role to DELETE accounts (soft delete via is_active = false)
CREATE POLICY "Allow anon delete on accounts"
  ON public.accounts FOR DELETE
  TO anon, authenticated
  USING (true);
