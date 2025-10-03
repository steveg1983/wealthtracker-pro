-- Complete fix for accounts.user_id type mismatch with RLS policies

-- Step 1: Drop all RLS policies on accounts table
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can create their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON accounts;

-- Step 2: Drop the foreign key constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_clerk_fkey;

-- Step 3: Change the column type from TEXT to UUID
ALTER TABLE accounts 
ALTER COLUMN user_id TYPE UUID 
USING user_id::UUID;

-- Step 4: Add the foreign key constraint
ALTER TABLE accounts 
ADD CONSTRAINT accounts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 5: Recreate RLS policies with correct UUID type
-- Enable RLS if not already enabled
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (viewing accounts)
CREATE POLICY "Users can view their own accounts"
  ON accounts FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

-- Policy for INSERT (creating new accounts)
CREATE POLICY "Users can create their own accounts"
  ON accounts FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

-- Policy for UPDATE (modifying accounts)
CREATE POLICY "Users can update their own accounts"
  ON accounts FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

-- Policy for DELETE (removing accounts)
CREATE POLICY "Users can delete their own accounts"
  ON accounts FOR DELETE
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

-- Step 6: Verify the fix
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
    AND column_name = 'user_id';

-- Should now show 'uuid' as the data type

-- Step 7: Check policies are recreated
SELECT * FROM pg_policies WHERE tablename = 'accounts';