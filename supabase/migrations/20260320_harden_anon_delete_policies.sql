-- Harden DELETE RLS policies for Clerk + anon-key frontend access.
--
-- The frontend uses the anon key and does not maintain a Supabase auth session,
-- so permissive DELETE policies become effectively global deletes for any row
-- whose id is known. Reads/inserts/updates may still be app-scoped, but DELETE
-- needs stronger protection.
--
-- Accounts are archived via UPDATE (is_active = false), not DELETE.
-- Categories are not deleted directly via the Supabase client today.
-- Transactions deletes are moved behind a Clerk-authenticated API route, so
-- the table can safely block anon deletes again.

-- Accounts: remove permissive anon delete if present.
DROP POLICY IF EXISTS "Allow anon delete on accounts" ON public.accounts;

-- Categories: remove permissive anon delete if present.
DROP POLICY IF EXISTS "Allow anon delete on categories" ON public.categories;

-- Transactions: remove any permissive anon delete drift and restore strict policy.
DROP POLICY IF EXISTS "Allow anon delete on transactions" ON public.transactions;
DROP POLICY IF EXISTS anon_delete_transactions ON public.transactions;
DROP POLICY IF EXISTS "delete_own_transactions" ON public.transactions;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY "delete_own_transactions"
ON public.transactions
FOR DELETE
TO anon, authenticated
USING (
  (auth.jwt()->>'role' = 'service_role')
  OR
  (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
);
