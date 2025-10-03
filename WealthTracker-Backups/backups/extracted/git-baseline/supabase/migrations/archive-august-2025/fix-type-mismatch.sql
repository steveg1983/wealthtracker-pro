-- Fix type mismatch between accounts.user_id (TEXT) and users.id (UUID)

-- Step 1: Check current column types
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
    AND column_name = 'user_id';

-- Step 2: Check what's in the users table
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('id', 'clerk_id');

-- Step 3: Drop the existing constraint first
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- Step 4: We have two options:
-- OPTION A: If accounts.user_id contains Clerk IDs (like 'user_31NgYqWomiEWQXfoNHEVuJqrwRR')
-- We should reference users.clerk_id instead:

ALTER TABLE accounts 
ADD CONSTRAINT accounts_user_clerk_fkey 
FOREIGN KEY (user_id) REFERENCES users(clerk_id) ON DELETE CASCADE;

-- OPTION B: If we want to use UUID references, we need to:
-- 1. Add a new column for UUID reference
-- 2. Populate it with the correct UUID from users table
-- 3. Switch to using that

-- First, let's try Option A since the app is already using Clerk IDs