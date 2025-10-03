-- Create budgets, goals, and investments tables
-- These are core features that were missing Supabase integration

-- 1. Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
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
  alert_threshold DECIMAL(5,2) DEFAULT 80, -- Alert when spent reaches this percentage
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, period)
);

-- 2. Create goals table
CREATE TABLE IF NOT EXISTS goals (
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

-- 3. Create investments table
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

-- 4. Create investment_transactions table for tracking buys/sells
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

-- 5. Create goal_contributions table for tracking progress
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
CREATE INDEX IF NOT EXISTS idx_budgets_is_active ON budgets(is_active);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_account_id ON goals(account_id);

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

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
CREATE TRIGGER update_budgets_updated_at 
  BEFORE UPDATE ON budgets
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at 
  BEFORE UPDATE ON goals
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_investments_updated_at ON investments;
CREATE TRIGGER update_investments_updated_at 
  BEFORE UPDATE ON investments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (temporarily allow all for now, similar to categories)
-- Budgets policies
DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own budgets" ON budgets;
CREATE POLICY "Users can create own budgets" ON budgets
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;
CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (TRUE);

-- Goals policies
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals" ON goals
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own goals" ON goals;
CREATE POLICY "Users can create own goals" ON goals
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals" ON goals
  FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals" ON goals
  FOR DELETE USING (TRUE);

-- Investments policies
DROP POLICY IF EXISTS "Users can view own investments" ON investments;
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own investments" ON investments;
CREATE POLICY "Users can create own investments" ON investments
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can update own investments" ON investments;
CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Users can delete own investments" ON investments;
CREATE POLICY "Users can delete own investments" ON investments
  FOR DELETE USING (TRUE);

-- Investment transactions policies
DROP POLICY IF EXISTS "Users can view own investment transactions" ON investment_transactions;
CREATE POLICY "Users can view own investment transactions" ON investment_transactions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own investment transactions" ON investment_transactions;
CREATE POLICY "Users can create own investment transactions" ON investment_transactions
  FOR INSERT WITH CHECK (TRUE);

-- Goal contributions policies  
DROP POLICY IF EXISTS "Users can view own goal contributions" ON goal_contributions;
CREATE POLICY "Users can view own goal contributions" ON goal_contributions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own goal contributions" ON goal_contributions;
CREATE POLICY "Users can create own goal contributions" ON goal_contributions
  FOR INSERT WITH CHECK (TRUE);

-- Grant permissions
GRANT ALL ON budgets TO service_role;
GRANT ALL ON goals TO service_role;
GRANT ALL ON investments TO service_role;
GRANT ALL ON investment_transactions TO service_role;
GRANT ALL ON goal_contributions TO service_role;

-- Create function to update budget spent amount based on transactions
-- FIXED: Using COALESCE to handle potential NULL values
CREATE OR REPLACE FUNCTION update_budget_spent()
RETURNS TRIGGER AS $$
DECLARE
  budget_record RECORD;
  v_category_id UUID;
  v_user_id UUID;
  v_date DATE;
  v_type TEXT;
BEGIN
  -- Handle both NEW and OLD records for DELETE operations
  IF TG_OP = 'DELETE' THEN
    v_category_id := OLD.category_id;
    v_user_id := OLD.user_id;
    v_date := OLD.date;
    v_type := OLD.type;
  ELSE
    v_category_id := NEW.category_id;
    v_user_id := NEW.user_id;
    v_date := NEW.date;
    v_type := NEW.type;
  END IF;
  
  -- Skip if no category_id or not an expense
  IF v_category_id IS NULL OR v_type != 'expense' THEN
    RETURN NEW;
  END IF;
  
  -- Find matching budget based on category and date
  FOR budget_record IN 
    SELECT b.* FROM budgets b
    WHERE b.category_id = v_category_id
      AND b.user_id = v_user_id
      AND b.is_active = TRUE
      AND v_date BETWEEN COALESCE(b.start_date, '1900-01-01'::DATE) 
                     AND COALESCE(b.end_date, '2999-12-31'::DATE)
  LOOP
    -- Update spent amount
    UPDATE budgets
    SET spent = (
      SELECT COALESCE(SUM(ABS(amount)), 0)
      FROM transactions
      WHERE category_id = budget_record.category_id
        AND user_id = budget_record.user_id
        AND date BETWEEN COALESCE(budget_record.start_date, '1900-01-01'::DATE) 
                    AND COALESCE(budget_record.end_date, '2999-12-31'::DATE)
        AND type = 'expense'
    )
    WHERE id = budget_record.id;
  END LOOP;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update budget spent on transaction changes
-- FIXED: Proper WHEN clause syntax
DROP TRIGGER IF EXISTS update_budget_on_transaction ON transactions;
CREATE TRIGGER update_budget_on_transaction
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_spent();