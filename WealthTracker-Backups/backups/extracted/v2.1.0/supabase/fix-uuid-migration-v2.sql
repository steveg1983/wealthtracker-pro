-- Fix UUID Migration Script V2
-- This script handles the mismatch between Clerk string IDs and Supabase UUID columns
-- Only includes tables that actually exist in your database

-- ========================================
-- STEP 1: Drop existing foreign key constraints
-- ========================================

-- Core tables
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_user_id_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
ALTER TABLE recurring_transactions DROP CONSTRAINT IF EXISTS recurring_transactions_user_id_fkey;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

-- Subscription tables (if they exist)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscription_usage DROP CONSTRAINT IF EXISTS subscription_usage_user_id_fkey;

-- ========================================
-- STEP 2: Change user_id columns from UUID to TEXT
-- ========================================

-- Core tables
ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE transactions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE budgets ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE goals ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE categories ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE recurring_transactions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE investments ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Subscription tables (only if they exist)
DO $$ 
BEGIN
    -- Check if subscriptions table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        ALTER TABLE subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
    
    -- Check if subscription_usage table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_usage') THEN
        ALTER TABLE subscription_usage ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
END $$;

-- ========================================
-- STEP 3: Re-add foreign key constraints pointing to clerk_user_id
-- ========================================

-- Core tables
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

ALTER TABLE categories 
  ADD CONSTRAINT categories_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE recurring_transactions 
  ADD CONSTRAINT recurring_transactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

ALTER TABLE investments 
  ADD CONSTRAINT investments_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

-- Subscription tables (only if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        ALTER TABLE subscriptions 
          ADD CONSTRAINT subscriptions_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES user_profiles(clerk_user_id) 
          ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_usage') THEN
        ALTER TABLE subscription_usage 
          ADD CONSTRAINT subscription_usage_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES user_profiles(clerk_user_id) 
          ON DELETE CASCADE;
    END IF;
END $$;

-- ========================================
-- STEP 4: Update RLS Policies (if needed)
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can create own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- Create new policies using clerk_user_id directly
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own accounts" ON accounts
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- ========================================
-- STEP 5: Test the migration
-- ========================================

-- Check that the foreign keys are correctly set up
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('accounts', 'transactions', 'budgets', 'goals', 'categories', 'recurring_transactions', 'investments');

-- Check user_profiles table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ========================================
-- MIGRATION COMPLETE!
-- ========================================
-- Your database now accepts Clerk's string IDs directly
-- All user_id columns now reference clerk_user_id instead of the UUID id