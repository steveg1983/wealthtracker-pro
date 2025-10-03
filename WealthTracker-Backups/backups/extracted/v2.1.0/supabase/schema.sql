-- WealthTracker Database Schema
-- Run this in your Supabase SQL Editor
-- This creates all tables with Row Level Security for multi-tenant SaaS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USER PROFILES TABLE
-- ========================================
-- Links Clerk users to our database
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_user_profiles_clerk_id ON user_profiles(clerk_user_id);

-- ========================================
-- ACCOUNTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'loan', 'investment', 'cash')),
  balance DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  institution TEXT,
  account_number_last4 TEXT,
  is_active BOOLEAN DEFAULT true,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- ========================================
-- TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category TEXT NOT NULL,
  subcategory TEXT,
  tags TEXT[],
  notes TEXT,
  merchant TEXT,
  location TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,
  is_cleared BOOLEAN DEFAULT true,
  is_reconciled BOOLEAN DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);

-- ========================================
-- BUDGETS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold INTEGER DEFAULT 80, -- Percentage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);

-- ========================================
-- GOALS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(15,2) NOT NULL,
  current_amount DECIMAL(15,2) DEFAULT 0,
  target_date DATE,
  category TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  is_achieved BOOLEAN DEFAULT false,
  achieved_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);

-- ========================================
-- CATEGORIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  color TEXT,
  icon TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);

-- ========================================
-- RECURRING TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_create BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recurring_user_id ON recurring_transactions(user_id);

-- ========================================
-- INVESTMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(15,6) NOT NULL,
  purchase_price DECIMAL(15,2) NOT NULL,
  current_price DECIMAL(15,2),
  purchase_date DATE NOT NULL,
  asset_type TEXT CHECK (asset_type IN ('stock', 'bond', 'etf', 'mutual_fund', 'crypto', 'other')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_investments_user_id ON investments(user_id);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================
-- This ensures users can only see their own data

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (clerk_user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (clerk_user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (clerk_user_id = current_setting('app.current_user_id', true));

-- Accounts Policies
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can create own accounts" ON accounts
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

-- Similar policies for other tables (transactions, budgets, goals, etc.)
-- You can copy the pattern above for each table

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to set the current user for RLS
CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's total net worth
CREATE OR REPLACE FUNCTION get_net_worth(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('checking', 'savings', 'investment', 'cash') THEN balance
      WHEN type IN ('credit', 'loan') THEN -balance
      ELSE 0
    END
  ), 0) INTO total
  FROM accounts
  WHERE user_id = p_user_id AND is_active = true;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS
-- ========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SAMPLE DATA (Optional - for testing)
-- ========================================
-- Uncomment below to add sample categories

/*
INSERT INTO categories (name, type, color, icon, is_system) VALUES
  ('Salary', 'income', '#10B981', 'wallet', true),
  ('Freelance', 'income', '#06B6D4', 'briefcase', true),
  ('Investment Income', 'income', '#8B5CF6', 'trending-up', true),
  ('Food & Dining', 'expense', '#F59E0B', 'utensils', true),
  ('Transportation', 'expense', '#3B82F6', 'car', true),
  ('Shopping', 'expense', '#EC4899', 'shopping-bag', true),
  ('Entertainment', 'expense', '#F97316', 'tv', true),
  ('Bills & Utilities', 'expense', '#EF4444', 'file-text', true),
  ('Healthcare', 'expense', '#14B8A6', 'heart', true),
  ('Education', 'expense', '#A855F7', 'book', true),
  ('Rent/Mortgage', 'expense', '#6366F1', 'home', true),
  ('Insurance', 'expense', '#84CC16', 'shield', true);
*/