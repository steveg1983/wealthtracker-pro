-- Migration 010: Create budgets, goals, and investments tables
-- Consolidated from multiple conflicting 010_* migrations
-- Professional-grade schema with proper constraints and indexes

-- Create budgets table if not exists
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  spent DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  rollover BOOLEAN DEFAULT false,
  rollover_amount DECIMAL(15,2),
  alert_threshold DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create goals table if not exists
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('savings', 'debt-payoff', 'investment', 'custom')),
  target_amount DECIMAL(15,2) NOT NULL,
  current_amount DECIMAL(15,2) DEFAULT 0,
  target_date DATE,
  category VARCHAR(100),
  priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  progress DECIMAL(5,2) DEFAULT 0,
  auto_contribute BOOLEAN DEFAULT false,
  contribution_amount DECIMAL(15,2),
  contribution_frequency VARCHAR(20),
  icon VARCHAR(50),
  color VARCHAR(7),
  achieved BOOLEAN DEFAULT false,
  linked_account_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create investments table if not exists
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  shares DECIMAL(20,8) NOT NULL,
  cost_basis DECIMAL(15,2) NOT NULL,
  current_value DECIMAL(15,2) NOT NULL,
  current_price DECIMAL(15,4),
  asset_class VARCHAR(50),
  sector VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'USD',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create investment_transactions table if not exists
CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'split', 'transfer')),
  date DATE NOT NULL,
  shares DECIMAL(20,8),
  price DECIMAL(15,4),
  amount DECIMAL(15,2) NOT NULL,
  fees DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to transactions table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'category_id') THEN
    ALTER TABLE transactions ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'is_recurring') THEN
    ALTER TABLE transactions ADD COLUMN is_recurring BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'recurring_transaction_id') THEN
    ALTER TABLE transactions ADD COLUMN recurring_transaction_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'tags') THEN
    ALTER TABLE transactions ADD COLUMN tags TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'location') THEN
    ALTER TABLE transactions ADD COLUMN location VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'merchant') THEN
    ALTER TABLE transactions ADD COLUMN merchant VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'receipt_url') THEN
    ALTER TABLE transactions ADD COLUMN receipt_url TEXT;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
CREATE INDEX IF NOT EXISTS idx_budgets_is_active ON budgets(is_active);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(type);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_account_id ON investments(account_id);
CREATE INDEX IF NOT EXISTS idx_investments_symbol ON investments(symbol);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(date);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_type ON investment_transactions(type);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers only if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budgets_updated_at') THEN
    CREATE TRIGGER update_budgets_updated_at 
      BEFORE UPDATE ON budgets 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_goals_updated_at') THEN
    CREATE TRIGGER update_goals_updated_at 
      BEFORE UPDATE ON goals 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_investments_updated_at') THEN
    CREATE TRIGGER update_investments_updated_at 
      BEFORE UPDATE ON investments 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable Row Level Security (but keep policies open for now)
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

-- Create open policies (temporary - to be restricted later)
CREATE POLICY "budgets_policy" ON budgets FOR ALL USING (true);
CREATE POLICY "goals_policy" ON goals FOR ALL USING (true);
CREATE POLICY "investments_policy" ON investments FOR ALL USING (true);
CREATE POLICY "investment_transactions_policy" ON investment_transactions FOR ALL USING (true);