-- PROPER FIX: Drop existing incomplete tables and recreate them correctly

-- 1. Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS goal_contributions CASCADE;
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investments CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;

-- 2. Now create them properly with all columns

-- Create budgets table with category_id column
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  spent DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  rollover BOOLEAN DEFAULT FALSE,
  rollover_amount DECIMAL(10,2) DEFAULT 0,
  alert_threshold DECIMAL(5,2) DEFAULT 80,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, period)
);

-- Create goals table
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) DEFAULT 0,
  target_date DATE,
  category TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  auto_contribute BOOLEAN DEFAULT FALSE,
  contribution_amount DECIMAL(10,2),
  contribution_frequency TEXT CHECK (contribution_frequency IN ('weekly', 'biweekly', 'monthly')),
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, name)
);

-- Create investments table
CREATE TABLE investments (
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

-- Create investment_transactions table
CREATE TABLE investment_transactions (
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

-- Create goal_contributions table
CREATE TABLE goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
CREATE INDEX idx_budgets_period ON budgets(period);
CREATE INDEX idx_budgets_is_active ON budgets(is_active);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_target_date ON goals(target_date);
CREATE INDEX idx_goals_account_id ON goals(account_id);

CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_account_id ON investments(account_id);
CREATE INDEX idx_investments_symbol ON investments(symbol);
CREATE INDEX idx_investments_asset_type ON investments(asset_type);

CREATE INDEX idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(date);

CREATE INDEX idx_goal_contributions_goal_id ON goal_contributions(goal_id);
CREATE INDEX idx_goal_contributions_user_id ON goal_contributions(user_id);
CREATE INDEX idx_goal_contributions_date ON goal_contributions(date);

-- Create or replace update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_budgets_updated_at 
  BEFORE UPDATE ON budgets
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at 
  BEFORE UPDATE ON goals
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at 
  BEFORE UPDATE ON investments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies
CREATE POLICY "Enable all for budgets" ON budgets FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for goals" ON goals FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for investments" ON investments FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for investment_transactions" ON investment_transactions FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for goal_contributions" ON goal_contributions FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Grant permissions
GRANT ALL ON budgets TO service_role;
GRANT ALL ON goals TO service_role;
GRANT ALL ON investments TO service_role;
GRANT ALL ON investment_transactions TO service_role;
GRANT ALL ON goal_contributions TO service_role;

-- Success
SELECT 'Migration completed successfully!' as status;