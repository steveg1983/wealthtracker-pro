-- Verify and Clean User Profiles
-- First, let's get accurate counts and then clean up if needed

-- 1. Get the EXACT count of user_profiles
SELECT COUNT(*) as actual_total_profiles FROM user_profiles;

-- 2. Get distinct emails to see if there are others
SELECT DISTINCT email, COUNT(*) as count
FROM user_profiles
GROUP BY email;

-- 3. Check if we actually have duplicates by ID
SELECT COUNT(DISTINCT id) as unique_profiles,
       COUNT(*) as total_rows
FROM user_profiles;

-- 4. Your legitimate profile (to keep)
SELECT * FROM user_profiles
WHERE clerk_user_id = 'user_31NgYqWomiEWQXfoNHEVuJqrwRR';

-- 5. Check if there are any profiles that are NOT this clerk_user_id
SELECT COUNT(*) as other_clerk_ids
FROM user_profiles  
WHERE clerk_user_id != 'user_31NgYqWomiEWQXfoNHEVuJqrwRR'
   OR clerk_user_id IS NULL;

-- 6. If there ARE duplicates, here's the cleanup script
-- ONLY RUN THIS AFTER CONFIRMING THERE ARE DUPLICATES!
/*
-- Step 1: Delete all profiles except your legitimate one
DELETE FROM user_profiles
WHERE id != '67317312-39f1-4599-857b-47fac0d0d058';

-- Step 2: Add unique constraints to prevent future duplicates
ALTER TABLE user_profiles 
ADD CONSTRAINT unique_clerk_user_id UNIQUE (clerk_user_id);

ALTER TABLE user_profiles
ADD CONSTRAINT unique_email UNIQUE (email);

-- Step 3: Verify only one profile remains
SELECT COUNT(*) as remaining_profiles FROM user_profiles;
SELECT * FROM user_profiles;
*/