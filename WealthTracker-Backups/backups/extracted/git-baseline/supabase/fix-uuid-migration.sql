-- Fix UUID Migration Script
-- This script handles the mismatch between Clerk string IDs and Supabase UUID columns
-- Run this in your Supabase SQL Editor if you encounter UUID errors

-- ========================================
-- OPTION 1: Modify columns to accept TEXT instead of UUID
-- (Simpler approach if you don't have existing data)
-- ========================================

-- First, drop existing foreign key constraints
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_user_id_fkey;
ALTER TABLE recurring_transactions DROP CONSTRAINT IF EXISTS recurring_transactions_user_id_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_user_id_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscription_usage DROP CONSTRAINT IF EXISTS subscription_usage_user_id_fkey;

-- Change user_id columns from UUID to TEXT
ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE transactions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE budgets ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE goals ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE recurring_transactions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE categories ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE tags ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE subscriptions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE subscription_usage ALTER COLUMN user_id TYPE TEXT;

-- Re-add foreign key constraints pointing to clerk_user_id instead of id
ALTER TABLE accounts 
  ADD CONSTRAINT accounts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE transactions 
  ADD CONSTRAINT transactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE budgets 
  ADD CONSTRAINT budgets_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE goals 
  ADD CONSTRAINT goals_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE recurring_transactions 
  ADD CONSTRAINT recurring_transactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE categories 
  ADD CONSTRAINT categories_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE tags 
  ADD CONSTRAINT tags_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE subscriptions 
  ADD CONSTRAINT subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE subscription_usage 
  ADD CONSTRAINT subscription_usage_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

-- Update RLS policies to use clerk_user_id
-- (You'll need to update your RLS policies to match the new structure)

-- ========================================
-- OPTION 2: Keep UUID columns but map properly in application
-- (Use the code changes we made to supabaseService.ts)
-- ========================================

-- This option doesn't require database changes, just ensure:
-- 1. user_profiles table has both id (UUID) and clerk_user_id (TEXT)
-- 2. Application code maps clerk_user_id to id before operations
-- 3. This is what we implemented in the supabaseService.ts changes

-- ========================================
-- Quick Test
-- ========================================
-- After running either option, test with:
SELECT 
  up.id as uuid_id,
  up.clerk_user_id,
  up.email,
  up.subscription_tier
FROM user_profiles up
LIMIT 5;