-- Check User Profiles Investigation
-- Let's see what's actually in the user_profiles table

-- 1. Count total profiles
SELECT COUNT(*) as total_profiles FROM user_profiles;

-- 2. Check for duplicate auth_ids
SELECT 
    auth_id, 
    COUNT(*) as count 
FROM user_profiles 
GROUP BY auth_id 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. Sample of user profiles to see what they look like
SELECT 
    id,
    auth_id,
    email,
    created_at,
    subscription_tier,
    subscription_status
FROM user_profiles
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check for null or empty auth_ids
SELECT COUNT(*) as profiles_without_auth_id
FROM user_profiles
WHERE auth_id IS NULL OR auth_id = '';

-- 5. Group by subscription tier to see distribution
SELECT 
    subscription_tier,
    subscription_status,
    COUNT(*) as count
FROM user_profiles
GROUP BY subscription_tier, subscription_status
ORDER BY count DESC;

-- 6. Check if there are test/dummy profiles
SELECT COUNT(*) as possible_test_profiles
FROM user_profiles
WHERE email LIKE '%test%' 
   OR email LIKE '%example%'
   OR email LIKE '%demo%'
   OR auth_id LIKE 'test%'
   OR auth_id LIKE 'demo%';