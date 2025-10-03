 pointing to clerk_user_id
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
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        ALTER TABLE payment_methods 
          ADD CONSTRAINT payment_methods_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES user_profiles(clerk_user_id) 
          ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE invoices 
          ADD CONSTRAINT invoices_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES user_profiles(clerk_user_id) 
          ON DELETE CASCADE;
    END IF;
END $$;

-- ========================================
-- STEP 5: Recreate RLS Policies with TEXT user_id
-- ========================================

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own accounts" ON accounts
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Budgets policies
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own budgets" ON budgets
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Goals policies
CREATE POLICY "Users can view own goals" ON goals
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own goals" ON goals
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own goals" ON goals
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own goals" ON goals
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own categories" ON categories
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Recurring transactions policies
CREATE POLICY "Users can view own recurring" ON recurring_transactions
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own recurring" ON recurring_transactions
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own recurring" ON recurring_transactions
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own recurring" ON recurring_transactions
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Investments policies
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own investments" ON investments
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own investments" ON investments
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Subscription-related policies (if tables exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_usage') THEN
        CREATE POLICY "Users can view own usage" ON subscription_usage
          FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
        
        CREATE POLICY "System can update usage" ON subscription_usage
          FOR ALL USING (true);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        CREATE POLICY "Users can view own payment methods" ON payment_methods
          FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        CREATE POLICY "Users can view own invoices" ON invoices
          FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
    END IF;
END $$;

-- ========================================
-- STEP 6: Verification Queries
-- ========================================

-- Check that the foreign keys are correctly set up
SELECT 
    'Foreign Key Check' as check_type,
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
  AND tc.table_name IN ('accounts', 'transactions', 'budgets', 'goals')
LIMIT 5;

-- Check column types
SELECT 
    'Column Type Check' as check_type,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('accounts', 'transactions', 'user_profiles')
  AND column_name IN ('user_id', 'clerk_user_id', 'id')
ORDER BY table_name, column_name;

-- ========================================
-- MIGRATION COMPLETE!
-- ========================================
-- Your database now accepts Clerk's string IDs directly
-- All user_id columns now reference clerk_user_id instead of the UUID id-- Fix UUID Migration Script V3
-- This script handles the mismatch between Clerk string IDs and Supabase UUID columns
-- Fixed to handle existing policies properly

-- ========================================
-- STEP 1: Drop ALL existing RLS policies FIRST
-- (Must be done before altering column types)
-- ========================================

-- Drop policies on all tables that have user_id columns
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on tables with user_id columns
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN (
            'accounts', 'transactions', 'budgets', 'goals', 
            'categories', 'recurring_transactions', 'investments',
            'subscriptions', 'subscription_usage', 'payment_methods', 'invoices'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ========================================
-- STEP 2: Drop existing foreign key constraints
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
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_user_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;

-- ========================================
-- STEP 3: Change user_id columns from UUID to TEXT
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
    
    -- Check if payment_methods table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        ALTER TABLE payment_methods ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
    
    -- Check if invoices table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE invoices ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
END $$;

-- ========================================
-- STEP 4: Re-add foreign key constraints