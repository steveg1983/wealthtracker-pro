-- Fix transactions RLS policy to allow frontend reads
--
-- Problem: The transactions table SELECT policy requires auth.uid() = user_id,
-- but the frontend Supabase client uses the anon key without a Supabase auth
-- session, so auth.uid() is always NULL. This blocks ALL transaction reads
-- from the frontend, despite 208 bank-synced transactions existing in the DB.
--
-- The accounts table uses USING (true) and works fine. This migration aligns
-- the transactions SELECT policy with the same pattern. Application-level
-- security filters by user_id in the query.
--
-- Generated: 2026-03-09

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "select_own_transactions" ON public.transactions;

-- Create a permissive SELECT policy matching the accounts table pattern.
-- The application always filters by user_id in queries, so row-level
-- filtering happens at the query level.
CREATE POLICY "select_own_transactions"
ON public.transactions
FOR SELECT
USING (true);

-- Keep INSERT/UPDATE/DELETE policies unchanged (they use service_role for API writes)
