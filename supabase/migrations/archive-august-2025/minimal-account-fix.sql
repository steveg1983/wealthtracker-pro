-- Minimal fix to get account creation working
-- This is the simplest possible fix

-- Step 1: Drop the broken constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- Step 2: Change user_id to TEXT type (matching Clerk IDs)
ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 3: For now, don't add foreign key constraint
-- This allows account creation to work immediately

-- Step 4: Grant permissions
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON accounts TO anon;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' AND column_name = 'user_id';

-- Should show 'text' as the data type