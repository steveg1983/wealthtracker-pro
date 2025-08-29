-- Simple fix for user table issues
-- Run this directly in Supabase SQL editor

-- Step 1: Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_profiles');

-- Step 2: If you see 'user_profiles' but not 'users', run this:
-- ALTER TABLE user_profiles RENAME TO users;

-- Step 3: If you see both tables, we need to fix the foreign key
-- First drop the existing constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- Step 4: Add the correct constraint pointing to users table
ALTER TABLE accounts 
ADD CONSTRAINT accounts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 5: Verify the fix worked
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.constraint_column_usage AS ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'accounts' 
  AND tc.constraint_type = 'FOREIGN KEY';