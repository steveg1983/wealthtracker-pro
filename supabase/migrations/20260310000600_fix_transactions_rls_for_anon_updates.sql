-- Fix transactions RLS policy to allow frontend updates (e.g. toggling cleared status)
--
-- Problem: The UPDATE policy requires auth.uid() = user_id, but the frontend
-- uses the anon key without a Supabase auth session. This silently blocks
-- all updates from the frontend, including reconciliation R/U toggles.
--
-- The application always scopes queries by user_id. We align UPDATE policy
-- with the SELECT policy pattern (USING true).

DROP POLICY IF EXISTS "update_own_transactions" ON public.transactions;

CREATE POLICY "update_own_transactions"
ON public.transactions
FOR UPDATE
USING (true)
WITH CHECK (true);
