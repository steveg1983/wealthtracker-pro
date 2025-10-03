-- Complete fix: Drop ALL policies, fix type, recreate policies

-- Step 1: First, let's see all policies on accounts table
SELECT policyname FROM pg_policies WHERE tablename = 'accounts';

-- Step 2: Generate commands to drop ALL policies (run this query to see the commands)
SELECT 'DROP POLICY IF EXISTS "' || policyname || '" ON accounts;' 
FROM pg_policies 
WHERE tablename = 'accounts';

-- Step 3: Drop ALL policies on accounts table (including any we might have missed)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'accounts'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON accounts';
    END LOOP;
END $$;

-- Step 4: Drop foreign key constraints
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_clerk_fkey;

-- Step 5: Now change the column type
ALTER TABLE accounts 
ALTER COLUMN user_id TYPE UUID 
USING user_id::UUID;

-- Step 6: Add the foreign key constraint
ALTER TABLE accounts 
ADD CONSTRAINT accounts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 7: Recreate RLS policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Simple policies for now (we can refine later)
CREATE POLICY "Enable all access for authenticated users own accounts"
  ON accounts 
  FOR ALL 
  USING (
    user_id IN (
      SELECT id FROM users 
      WHERE clerk_id = auth.uid()::TEXT
      OR id::TEXT = auth.uid()::TEXT
    )
  );

-- Step 8: Verify the column type is fixed
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
    AND column_name = 'user_id';

-- Step 9: Verify policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'accounts';