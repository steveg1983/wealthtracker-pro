-- Investigate the 1060 user profiles issue

-- 1. Count total profiles
SELECT COUNT(*) as total_profiles FROM user_profiles;

-- 2. Check for duplicate clerk_user_ids
SELECT 
    clerk_user_id, 
    COUNT(*) as count 
FROM user_profiles 
GROUP BY clerk_user_id 
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 10;

-- 3. Check profiles by email
SELECT 
    email,
    COUNT(*) as count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM user_profiles
GROUP BY email
ORDER BY count DESC
LIMIT 10;

-- 4. Check for null emails or clerk_user_ids
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN email IS NULL THEN 1 END) as null_emails,
    COUNT(CASE WHEN clerk_user_id IS NULL THEN 1 END) as null_clerk_ids,
    COUNT(CASE WHEN email = '' THEN 1 END) as empty_emails,
    COUNT(CASE WHEN clerk_user_id = '' THEN 1 END) as empty_clerk_ids
FROM user_profiles;

-- 5. Sample of profiles with NULL or empty values
SELECT id, clerk_user_id, email, created_at
FROM user_profiles
WHERE email IS NULL 
   OR email = ''
   OR clerk_user_id IS NULL
   OR clerk_user_id = ''
LIMIT 20;

-- 6. Check creation pattern - were they all created at once?
SELECT 
    DATE(created_at) as creation_date,
    COUNT(*) as profiles_created
FROM user_profiles
GROUP BY DATE(created_at)
ORDER BY creation_date DESC;

-- 7. Get your legitimate profile
SELECT * FROM user_profiles 
WHERE email = 's.green1983@outlook.com';

-- 8. Count profiles that are NOT yours
SELECT COUNT(*) as other_profiles
FROM user_profiles
WHERE email != 's.green1983@outlook.com' 
   OR email IS NULL;