-- Fix: Alter existing tables instead of recreating them
-- This migration updates the existing tables created in 001_initial_schema.sql

-- 1. First drop any duplicate tables that might have been created
DROP TABLE IF EXISTS goal_contributions CASCADE;
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investments CASCADE;

-- 2. Alter the existing budgets table to match our new requirements
-- The table already exists from 001_initial_schema.sql but needs modifications
ALTER TABLE budgets 
  DROP COLUMN IF EXISTS rollover_enabled,
  DROP COLUMN IF EXISTS alert_enabled,
  DROP COLUMN IF EXISTS alert_threshold,
  DROP COLUMN IF EXISTS metadata,
  ADD COLUMN IF NOT EXISTS spent DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rollover BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rollover_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_threshold DECIMAL(5,2) DEFAULT 80,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update period constraint to include more options
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_period_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_period_check 
  CHECK (period IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'));

-- 3. Alter the existing goals table
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  DROP COLUMN IF EXISTS metadata;

-- Update contribution_frequency constraint
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_contribution_frequency_check;
ALTER TABLE goals ADD CONSTRAINT goals_contribution_frequency_check 
  CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly'));

-- 4. Create new investments table
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(20,8) NOT NULL,
  cost_basis DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  market_value DECIMAL(10,2),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'bond', 'etf', 'mutual_fund', 'crypto', 'commodity', 'real_estate', 'other')),
  exchange TEXT,
  currency TEXT DEFAULT 'GBP',
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  last_updated TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create investment_transactions table
CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'split', 'transfer')),
  quantity DECIMAL(20,8) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  fees DECIMAL(10,2) DEFAULT 0,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create goal_contributions table
CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_account_id ON investments(account_id);
CREATE INDEX IF NOT EXISTS idx_investments_symbol ON investments(symbol);
CREATE INDEX IF NOT EXISTS idx_investments_asset_type ON investments(asset_type);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(date);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id ON goal_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_date ON goal_contributions(date);

-- 8. Add updated_at triggers for new tables
CREATE TRIGGER update_investments_updated_at 
  BEFORE UPDATE ON investments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Enable RLS on new tables
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for new tables
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can create own investments" ON investments
  FOR INSERT WITH CHECK (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can delete own investments" ON investments
  FOR DELETE USING (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can view own investment transactions" ON investment_transactions
  FOR SELECT USING (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can create own investment transactions" ON investment_transactions
  FOR INSERT WITH CHECK (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can view own goal contributions" ON goal_contributions
  FOR SELECT USING (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can create own goal contributions" ON goal_contributions
  FOR INSERT WITH CHECK (auth.uid()::text = (SELECT clerk_id FROM users WHERE id = user_id));

-- Success
SELECT 'Migration completed successfully - existing tables altered and new tables created!' as status;