-- Check Data Mismatch (Fixed)
-- This script helps identify the data issues before migration

-- ========================================
-- 1. Check what's in user_profiles
-- ========================================
SELECT 
    'User Profiles' as table_info,
    id,
    clerk_user_id,
    email,
    subscription_tier
FROM user_profiles
LIMIT 10;

-- ========================================
-- 2. Check what user_ids are in accounts
-- ========================================
SELECT 
    'Accounts User IDs' as table_info,
    user_id,
    COUNT(*) as account_count
FROM accounts
GROUP BY user_id
LIMIT 10;

-- ========================================
-- 3. Check if accounts.user_id matches user_profiles.id (old way)
-- ========================================
SELECT 
    'Accounts with valid UUID references' as check_type,
    a.user_id,
    a.name as account_name,
    up.id as profile_uuid,
    up.clerk_user_id
FROM accounts a
LEFT JOIN user_profiles up ON a.user_id::text = up.id::text
WHERE up.id IS NOT NULL
LIMIT 10;

-- ========================================
-- 4. Check if accounts.user_id matches user_profiles.clerk_user_id (new way)
-- ========================================
SELECT 
    'Accounts with Clerk ID references' as check_type,
    a.user_id,
    a.name as account_name,
    up.clerk_user_id
FROM accounts a
LEFT JOIN user_profiles up ON a.user_id::text = up.clerk_user_id
WHERE up.clerk_user_id IS NOT NULL
LIMIT 10;

-- ========================================
-- 5. Count mismatches
-- ========================================
SELECT 
    'Data Summary' as summary,
    (SELECT COUNT(*) FROM user_profiles) as total_profiles,
    (SELECT COUNT(*) FROM accounts) as total_accounts,
    (SELECT COUNT(DISTINCT user_id) FROM accounts) as unique_account_users,
    (SELECT COUNT(*) FROM accounts a WHERE EXISTS (
        SELECT 1 FROM user_profiles up WHERE a.user_id::text = up.id::text
    )) as accounts_with_valid_uuid_ref,
    (SELECT COUNT(*) FROM accounts a WHERE EXISTS (
        SELECT 1 FROM user_profiles up WHERE a.user_id::text = up.clerk_user_id
    )) as accounts_with_clerk_id_ref;