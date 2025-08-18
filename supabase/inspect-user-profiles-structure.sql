-- First, let's see what columns actually exist in user_profiles table

-- 1. Show all columns in user_profiles table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 2. Just count the total rows
SELECT COUNT(*) as total_user_profiles FROM user_profiles;

-- 3. Get a sample of data (using * to see all columns)
SELECT * FROM user_profiles LIMIT 5;