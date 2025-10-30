-- Fix missing DELETE RLS policy for transactions table
-- Issue: Anonymous users could delete any transaction (critical security vulnerability)
-- Fix: Add proper RLS policy to ensure users can only delete their own transactions
--
-- Generated: 2025-10-30
-- Issue discovered by: Supabase smoke test failure

-- Drop any existing DELETE policies on transactions (if any)
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
DROP POLICY IF EXISTS "users_delete_own_transactions" ON public.transactions;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.transactions;

-- Create the correct DELETE policy
-- Users can only delete their own transactions
CREATE POLICY "Users can delete own transactions"
ON public.transactions
FOR DELETE
USING (
  -- Check if the user_id matches the authenticated user
  -- Note: auth.uid() returns the Supabase Auth user ID
  -- If using Clerk IDs, this may need adjustment to match the user_id format
  auth.uid()::text = user_id::text
  OR
  -- Service role can delete any transaction
  (auth.jwt()->>'role' = 'service_role')
);

-- Verify RLS is enabled on the transactions table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Add a comment to document this fix
COMMENT ON POLICY "Users can delete own transactions" ON public.transactions IS
'Ensures users can only delete their own transactions. Fixed security vulnerability where anonymous users could delete any transaction.';