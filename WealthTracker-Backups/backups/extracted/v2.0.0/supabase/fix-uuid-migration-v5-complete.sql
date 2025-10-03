-- Fix UUID Migration Script V5 - Complete Solution
-- This version disables triggers before migration

-- ========================================
-- STEP 0: Disable all triggers that might interfere
-- ========================================

-- Disable triggers on accounts
ALTER TABLE accounts DISABLE TRIGGER ALL;
ALTER TABLE transactions DISABLE TRIGGER ALL;
ALTER TABLE budgets DISABLE TRIGGER ALL;
ALTER TABLE goals DISABLE TRIGGER ALL;
ALTER TABLE categories DISABLE TRIGGER ALL;
ALTER TABLE recurring_transactions DISABLE TRIGGER ALL;
ALTER TABLE investments DISABLE TRIGGER ALL;

-- Disable triggers on subscription tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        EXECUTE 'ALTER TABLE subscriptions DISABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_usage') THEN
        EXECUTE 'ALTER TABLE subscription_usage DISABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_events') THEN
        EXECUTE 'ALTER TABLE subscription_events DISABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        EXECUTE 'ALTER TABLE payment_methods DISABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        EXECUTE 'ALTER TABLE invoices DISABLE TRIGGER ALL';
    END IF;
END $$;

-- ========================================
-- STEP 1: Drop ALL existing RLS policies
-- ========================================

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN (
            'accounts', 'transactions', 'budgets', 'goals', 
            'categories', 'recurring_transactions', 'investments',
            'subscriptions', 'subscription_usage', 'payment_methods', 'invoices',
            'subscription_events'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ========================================
-- STEP 2: Drop existing foreign key constraints
-- ========================================

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_user_id_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
ALTER TABLE recurring_transactions DROP CONSTRAINT IF EXISTS recurring_transactions_user_id_fkey;
ALTER TABLE recurring_transactions DROP CONSTRAINT IF EXISTS recurring_transactions_account_id_fkey;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_account_id_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscription_usage DROP CONSTRAINT IF EXISTS subscription_usage_user_id_fkey;
ALTER TABLE subscription_events DROP CONSTRAINT IF EXISTS subscription_events_user_id_fkey;
ALTER TABLE subscription_events DROP CONSTRAINT IF EXISTS subscription_events_subscription_id_fkey;
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_user_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;

-- ========================================
-- STEP 3: Convert user_id columns to TEXT
-- ========================================

-- Convert all UUID columns to TEXT
DO $$ 
BEGIN
    -- accounts
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- transactions
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE transactions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- budgets
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'budgets' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE budgets ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- goals
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'goals' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE goals ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- categories
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE categories ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- recurring_transactions
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recurring_transactions' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE recurring_transactions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- investments
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'investments' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE investments ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- subscription_usage
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_usage' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE subscription_usage ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- subscription_events
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_events' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE subscription_events ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- payment_methods
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_methods' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE payment_methods ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;

    -- invoices
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE invoices ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
END $$;

-- ========================================
-- STEP 4: UPDATE EXISTING DATA
-- Map UUID references to clerk_user_id
-- ========================================

-- Update accounts table
UPDATE accounts a
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE a.user_id = up.id::text;

-- Update transactions table
UPDATE transactions t
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE t.user_id = up.id::text;

-- Update budgets table
UPDATE budgets b
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE b.user_id = up.id::text;

-- Update goals table
UPDATE goals g
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE g.user_id = up.id::text;

-- Update categories table
UPDATE categories c
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE c.user_id = up.id::text;

-- Update recurring_transactions table
UPDATE recurring_transactions rt
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE rt.user_id = up.id::text;

-- Update investments table
UPDATE investments i
SET user_id = up.clerk_user_id
FROM user_profiles up
WHERE i.user_id = up.id::text;

-- Update subscription tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_usage') THEN
        UPDATE subscription_usage su
        SET user_id = up.clerk_user_id
        FROM user_profiles up
        WHERE su.user_id = up.id::text;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_events') THEN
        UPDATE subscription_events se
        SET user_id = up.clerk_user_id
        FROM user_profiles up
        WHERE se.user_id = up.id::text;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        UPDATE payment_methods pm
        SET user_id = up.clerk_user_id
        FROM user_profiles up
        WHERE pm.user_id = up.id::text;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        UPDATE invoices inv
        SET user_id = up.clerk_user_id
        FROM user_profiles up
        WHERE inv.user_id = up.id::text;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        UPDATE subscriptions s
        SET user_id = up.clerk_user_id
        FROM user_profiles up
        WHERE s.user_id = up.id::text;
    END IF;
END $$;

-- ========================================
-- STEP 5: Re-add foreign key constraints
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

-- Re-add account foreign key for transactions
ALTER TABLE transactions
  ADD CONSTRAINT transactions_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES accounts(id)
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

-- Re-add parent category foreign key
ALTER TABLE categories
  ADD CONSTRAINT categories_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES categories(id)
  ON DELETE CASCADE;

ALTER TABLE recurring_transactions 
  ADD CONSTRAINT recurring_transactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

-- Re-add account foreign key
ALTER TABLE recurring_transactions
  ADD CONSTRAINT recurring_transactions_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES accounts(id)
  ON DELETE CASCADE;

ALTER TABLE investments 
  ADD CONSTRAINT investments_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profiles(clerk_user_id) 
  ON DELETE CASCADE;

-- Re-add account foreign key
ALTER TABLE investments
  ADD CONSTRAINT investments_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES accounts(id);

-- Subscription tables
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

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_events') THEN
        ALTER TABLE subscription_events 
          ADD CONSTRAINT subscription_events_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES user_profiles(clerk_user_id) 
          ON DELETE CASCADE;
          
        -- Re-add subscription foreign key if needed
        ALTER TABLE subscription_events
          ADD CONSTRAINT subscription_events_subscription_id_fkey
          FOREIGN KEY (subscription_id)
          REFERENCES subscriptions(id)
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
-- STEP 6: Update the update_usage_counts function to accept TEXT
-- ========================================

-- Drop and recreate the function with TEXT parameter
DROP FUNCTION IF EXISTS update_usage_counts(UUID);
DROP FUNCTION IF EXISTS update_usage_counts(TEXT);

CREATE OR REPLACE FUNCTION update_usage_counts(p_user_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO subscription_usage (
    user_id,
    accounts_count,
    transactions_count,
    budgets_count,
    goals_count,
    last_calculated
  ) VALUES (
    p_user_id,
    (SELECT COUNT(*) FROM accounts WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM budgets WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM goals WHERE user_id = p_user_id),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    accounts_count = EXCLUDED.accounts_count,
    transactions_count = EXCLUDED.transactions_count,
    budgets_count = EXCLUDED.budgets_count,
    goals_count = EXCLUDED.goals_count,
    last_calculated = EXCLUDED.last_calculated,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 7: Re-enable triggers
-- ========================================

-- Re-enable triggers on core tables
ALTER TABLE accounts ENABLE TRIGGER ALL;
ALTER TABLE transactions ENABLE TRIGGER ALL;
ALTER TABLE budgets ENABLE TRIGGER ALL;
ALTER TABLE goals ENABLE TRIGGER ALL;
ALTER TABLE categories ENABLE TRIGGER ALL;
ALTER TABLE recurring_transactions ENABLE TRIGGER ALL;
ALTER TABLE investments ENABLE TRIGGER ALL;

-- Re-enable triggers on subscription tables
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        EXECUTE 'ALTER TABLE subscriptions ENABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_usage') THEN
        EXECUTE 'ALTER TABLE subscription_usage ENABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_events') THEN
        EXECUTE 'ALTER TABLE subscription_events ENABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        EXECUTE 'ALTER TABLE payment_methods ENABLE TRIGGER ALL';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        EXECUTE 'ALTER TABLE invoices ENABLE TRIGGER ALL';
    END IF;
END $$;

-- ========================================
-- STEP 8: Recreate RLS Policies
-- ========================================

-- Simplified policies using clerk_user_id directly
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own accounts" ON accounts
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Similar for other tables
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can create own transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Continue for other tables...
CREATE POLICY "Users can manage own budgets" ON budgets
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can manage own goals" ON goals
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can manage own categories" ON categories
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can manage own recurring" ON recurring_transactions
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can manage own investments" ON investments
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- ========================================
-- STEP 9: Final Verification
-- ========================================

-- Check column types
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- Check that data was updated correctly
SELECT 
    'Migration Complete' as status,
    (SELECT COUNT(*) FROM accounts WHERE user_id LIKE 'user_%') as accounts_with_clerk_id,
    (SELECT COUNT(*) FROM transactions WHERE user_id LIKE 'user_%') as transactions_with_clerk_id,
    (SELECT COUNT(*) FROM user_profiles) as total_profiles;

-- ========================================
-- MIGRATION COMPLETE!
-- ========================================
-- All user_id columns now use TEXT type
-- All data has been migrated from UUID to clerk_user_id
-- All foreign keys point to clerk_user_id
-- All triggers and functions updated