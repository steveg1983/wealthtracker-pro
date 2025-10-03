-- PROPER SOLUTION: Clean setup with existence checks
-- This handles both fresh installs and fixing existing broken schemas

-- Step 1: Check what we're working with
DO $$ 
BEGIN
  RAISE NOTICE 'Checking existing database state...';
END $$;

-- Step 2: Drop ONLY the broken accounts table and its dependents
-- We keep users table since it might have data
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS recurring_templates CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- Step 3: Ensure users table has correct structure (don't drop it)
-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'clerk_id') THEN
    ALTER TABLE users ADD COLUMN clerk_id TEXT UNIQUE NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email TEXT NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'subscription_tier') THEN
    ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free' 
      CHECK (subscription_tier IN ('free', 'pro', 'business'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'subscription_status') THEN
    ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active' 
      CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing'));
  END IF;
END $$;

-- Step 4: Create accounts table with CORRECT types
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'cash', 'investment', 'other')),
  currency TEXT DEFAULT 'GBP',
  balance DECIMAL(20, 2) DEFAULT 0,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  institution TEXT,
  account_number TEXT,
  sort_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Step 5: Create other tables with correct foreign keys
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  date DATE NOT NULL,
  category TEXT,
  notes TEXT,
  tags TEXT[],
  is_recurring BOOLEAN DEFAULT false,
  transfer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly', 'custom')),
  category TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(20, 2) NOT NULL,
  current_amount DECIMAL(20, 2) DEFAULT 0,
  target_date DATE,
  category TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- Step 7: Enable RLS with proper policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can manage their own profile" ON users;
DROP POLICY IF EXISTS "Users can manage their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can manage their own goals" ON goals;

-- Create clean policies
CREATE POLICY "Users can manage their own profile" ON users
  FOR ALL USING (auth.uid()::TEXT = clerk_id);

CREATE POLICY "Users can manage their own accounts" ON accounts
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = accounts.user_id 
    AND users.clerk_id = auth.uid()::TEXT
  ));

CREATE POLICY "Users can manage their own transactions" ON transactions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = transactions.user_id 
    AND users.clerk_id = auth.uid()::TEXT
  ));

CREATE POLICY "Users can manage their own budgets" ON budgets
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = budgets.user_id 
    AND users.clerk_id = auth.uid()::TEXT
  ));

CREATE POLICY "Users can manage their own goals" ON goals
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = goals.user_id 
    AND users.clerk_id = auth.uid()::TEXT
  ));

-- Step 8: Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Step 9: Create or replace trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create triggers only if they don't exist
DO $$ 
BEGIN
  -- Drop and recreate to ensure clean state
  DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
  CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
  DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
  CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
  DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
  CREATE TRIGGER update_budgets_updated_at 
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
  DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
  CREATE TRIGGER update_goals_updated_at 
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
  -- Only create users trigger if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Step 11: Verify the setup
DO $$ 
BEGIN
  RAISE NOTICE 'Database setup complete. Verifying...';
END $$;

-- Check that accounts.user_id is UUID
SELECT 
  'Accounts user_id type: ' || data_type as check_result
FROM information_schema.columns 
WHERE table_name = 'accounts' AND column_name = 'user_id';

-- Check foreign key exists
SELECT 
  'Foreign key exists: ' || COUNT(*)::TEXT as check_result
FROM information_schema.table_constraints 
WHERE table_name = 'accounts' 
  AND constraint_type = 'FOREIGN KEY';

-- Check RLS is enabled
SELECT 
  'RLS enabled on accounts: ' || rowsecurity::TEXT as check_result
FROM pg_tables 
WHERE tablename = 'accounts';

-- Final message
DO $$ 
BEGIN
  RAISE NOTICE 'Setup complete! Account creation should now work properly.';
END $$;