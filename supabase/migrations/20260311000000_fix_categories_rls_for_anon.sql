-- Fix categories RLS to allow anon key operations
--
-- The frontend uses the anon key (Clerk auth, not Supabase Auth), so auth.uid()
-- is always NULL. The trigger create_transfer_category_on_account_insert fires
-- AFTER INSERT on accounts and inserts into categories — this fails with 401
-- because the existing policy "Users manage own categories" requires auth.uid().
--
-- Same pattern as 20260310_fix_accounts_rls_for_anon.sql and the transactions fixes.

-- Allow anon role to SELECT categories
CREATE POLICY "Allow anon select on categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anon role to INSERT categories (needed by create_transfer_category_on_account_insert trigger)
CREATE POLICY "Allow anon insert on categories"
  ON public.categories FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon role to UPDATE categories
CREATE POLICY "Allow anon update on categories"
  ON public.categories FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon role to DELETE categories
CREATE POLICY "Allow anon delete on categories"
  ON public.categories FOR DELETE
  TO anon, authenticated
  USING (true);
