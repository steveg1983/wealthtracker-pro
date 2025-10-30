-- Diagnose and fix RLS issue on transactions table
-- Generated: 2025-10-30

-- 1. First, check if RLS is actually enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'transactions';

-- 2. Check what policies exist on the transactions table
SELECT
  polname AS policy_name,
  CASE polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pg_get_expr(polqual, polrelid) AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression,
  polroles::regrole[] AS roles
FROM pg_policy
WHERE polrelid = 'public.transactions'::regclass
ORDER BY polcmd;

-- 3. CRITICAL: Enable RLS if not enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 4. Drop ALL existing policies to start fresh
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.transactions'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', pol.polname);
  END LOOP;
END $$;

-- 5. Create comprehensive RLS policies

-- SELECT: Users can only see their own transactions
CREATE POLICY "select_own_transactions"
ON public.transactions
FOR SELECT
USING (
  (auth.jwt()->>'role' = 'service_role') OR
  (auth.uid()::text = user_id::text)
);

-- INSERT: Users can only insert their own transactions
CREATE POLICY "insert_own_transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  (auth.jwt()->>'role' = 'service_role') OR
  (auth.uid()::text = user_id::text)
);

-- UPDATE: Users can only update their own transactions
CREATE POLICY "update_own_transactions"
ON public.transactions
FOR UPDATE
USING (
  (auth.jwt()->>'role' = 'service_role') OR
  (auth.uid()::text = user_id::text)
)
WITH CHECK (
  (auth.jwt()->>'role' = 'service_role') OR
  (auth.uid()::text = user_id::text)
);

-- DELETE: Users can only delete their own transactions
-- CRITICAL: This must block anonymous users (where auth.uid() is NULL)
CREATE POLICY "delete_own_transactions"
ON public.transactions
FOR DELETE
USING (
  (auth.jwt()->>'role' = 'service_role') OR
  (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
);

-- 6. Verify RLS is enabled (should return 't' for true)
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'transactions';

-- 7. List all policies after changes
SELECT
  polname AS policy_name,
  CASE polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
  END AS command,
  pg_get_expr(polqual, polrelid) AS using_expression
FROM pg_policy
WHERE polrelid = 'public.transactions'::regclass
ORDER BY polcmd;