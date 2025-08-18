-- Cleanup Duplicate User Profiles
-- Keep only ONE profile and delete all duplicates

-- First, verify the situation
SELECT COUNT(*) as total_profiles FROM user_profiles;

-- Keep the oldest (original) profile and delete all others
WITH profile_to_keep AS (
    SELECT id
    FROM user_profiles
    WHERE clerk_user_id = 'user_31NgYqWomiEWQXfoNHEVuJqrwRR'
    ORDER BY created_at ASC
    LIMIT 1
)
DELETE FROM user_profiles
WHERE clerk_user_id = 'user_31NgYqWomiEWQXfoNHEVuJqrwRR'
  AND id NOT IN (SELECT id FROM profile_to_keep);

-- Verify only one remains
SELECT COUNT(*) as remaining_profiles FROM user_profiles;

-- Show the remaining profile
SELECT * FROM user_profiles;

-- Add constraints to prevent this from happening again
ALTER TABLE user_profiles 
ADD CONSTRAINT unique_clerk_user_id UNIQUE (clerk_user_id);

ALTER TABLE user_profiles
ADD CONSTRAINT unique_email UNIQUE (email);