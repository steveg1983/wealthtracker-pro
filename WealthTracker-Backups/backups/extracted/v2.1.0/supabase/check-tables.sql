-- Check existing tables and their structure
-- Run this to see what tables exist and what policies are active

-- ========================================
-- 1. List all tables
-- ========================================
SELECT 
    table_name,
    'Exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- ========================================
-- 2. Check user_profiles structure
-- ========================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ========================================
-- 3. Check if subscription_usage exists and its structure
-- ========================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'subscription_usage'
ORDER BY ordinal_position;

-- ========================================
-- 4. List all RLS policies
-- ========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================
-- 5. Check current user_id column types
-- ========================================
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE column_name = 'user_id'
  AND table_schema = 'public'
ORDER BY table_name;