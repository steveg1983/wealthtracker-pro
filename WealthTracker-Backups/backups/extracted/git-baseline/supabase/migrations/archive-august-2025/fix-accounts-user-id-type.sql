-- Fix accounts.user_id column type to match users.id (UUID)

-- Step 1: Drop the existing constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_clerk_fkey;

-- Step 2: Check if there's any data in accounts table
SELECT COUNT(*) as account_count FROM accounts;

-- Step 3: If the count is 0 (no data), we can safely change the column type
-- Run this ONLY if there are no accounts yet:
ALTER TABLE accounts 
ALTER COLUMN user_id TYPE UUID 
USING user_id::UUID;

-- Step 4: Add the foreign key constraint
ALTER TABLE accounts 
ADD CONSTRAINT accounts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 5: Verify the fix
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
    AND column_name = 'user_id';

-- Should now show 'uuid' as the data type