-- Check duplicate profiles for the same user

-- 1. Count all profiles with your email
SELECT COUNT(*) as total_profiles_with_your_email
FROM user_profiles
WHERE email = 's.green1983@outlook.com';

-- 2. Show all profiles with your email (limit to see pattern)
SELECT 
    id,
    clerk_user_id,
    email,
    subscription_tier,
    subscription_status,
    created_at,
    updated_at
FROM user_profiles
WHERE email = 's.green1983@outlook.com'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if they all have the same clerk_user_id
SELECT 
    clerk_user_id,
    COUNT(*) as count
FROM user_profiles
WHERE email = 's.green1983@outlook.com'
GROUP BY clerk_user_id;

-- 4. Check creation time pattern
SELECT 
    created_at,
    COUNT(*) as profiles_at_this_time
FROM user_profiles
WHERE email = 's.green1983@outlook.com'
GROUP BY created_at
ORDER BY created_at DESC
LIMIT 20;

-- 5. Get the OLDEST profile (likely the original)
SELECT * FROM user_profiles
WHERE email = 's.green1983@outlook.com'
ORDER BY created_at ASC
LIMIT 1;

-- 6. Get the NEWEST profile (likely the most recent duplicate)
SELECT * FROM user_profiles
WHERE email = 's.green1983@outlook.com'
ORDER BY created_at DESC
LIMIT 1;