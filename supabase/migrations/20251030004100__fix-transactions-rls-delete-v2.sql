-- Fix RLS DELETE policy for transactions table (Version 2)
-- Issue: Previous policy might not be blocking anonymous users correctly
-- Fix: Ensure only authenticated users can delete their own transactions
--
-- Generated: 2025-10-30

-- First, check what policies currently exist
-- (This is just for reference when reviewing)
-- SELECT polname, polcmd, qual FROM pg_policy WHERE polrelid = 'public.transactions'::regclass;

-- Drop the previous policy attempts
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
DROP POLICY IF EXISTS "users_delete_own_transactions" ON public.transactions;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.transactions;
DROP POLICY IF EXISTS "Service role has full access" ON public.transactions;

-- Create a comprehensive DELETE policy
-- This policy ensures:
-- 1. Anonymous/unauthenticated users cannot delete anything
-- 2. Authenticated users can only delete their own transactions
-- 3. Service role can delete anything
CREATE POLICY "Authenticated users delete own transactions only"
ON public.transactions
FOR DELETE
USING (
  -- Must be authenticated (auth.uid() is not null)
  auth.uid() IS NOT NULL
  AND (
    -- Either the user owns the transaction
    auth.uid()::text = user_id::text
    -- Or it's the service role
    OR (auth.jwt()->>'role') = 'service_role'
  )
);

-- Also ensure we have proper policies for other operations
-- Check if SELECT policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can view own transactions'
    AND polrelid = 'public.transactions'::regclass
  ) THEN
    CREATE POLICY "Users can view own transactions"
    ON public.transactions
    FOR SELECT
    USING (
      auth.uid()::text = user_id::text
      OR (auth.jwt()->>'role') = 'service_role'
    );
  END IF;
END $$;

-- Verify RLS is enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Add documentation
COMMENT ON POLICY "Authenticated users delete own transactions only" ON public.transactions IS
'Ensures only authenticated users can delete their own transactions. Anonymous users are completely blocked. Fixed to properly handle NULL auth.uid() case.';