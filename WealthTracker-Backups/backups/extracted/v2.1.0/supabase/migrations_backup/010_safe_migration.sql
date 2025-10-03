-- Safe migration that checks and adds only what's needed

-- 1. Drop any tables that were partially created
DROP TABLE IF EXISTS goal_contributions CASCADE;
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investments CASCADE;

-- 2. Add missing columns to budgets if they don't exist
ALTER TABLE budgets 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spent DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rollover BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rollover_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_threshold DECIMAL(5,2) DEFAULT 80,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Add missing columns to goals if they don't exist
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contribution_frequency TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT;

-- 4. Now add/update the constraint for contribution_frequency (only if column exists)
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_contribution_frequency_check;
  
  -- Only add constraint if the column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'goals' AND column_name = 'contribution_frequency') THEN
    ALTER TABLE goals ADD CONSTRAINT goals_contribution_frequency_check 
      CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly'));
  END IF;
END $$;

-- 5. Update budgets period constraint to include more options
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_period_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_period_check 
  CHECK (period IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'));

-- 6. Create investments table
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

-- 7. Create investment_transactions table
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

-- 8. Create goal_contributions table
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

-- 9. Create indexes
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

-- 10. Add triggers
CREATE TRIGGER update_investments_updated_at 
  BEFORE UPDATE ON investments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Enable RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

-- 12. Create simple RLS policies
CREATE POLICY "Enable all for investments" ON investments FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for investment_transactions" ON investment_transactions FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for goal_contributions" ON goal_contributions FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Success
SELECT 'Migration completed successfully!' as status;