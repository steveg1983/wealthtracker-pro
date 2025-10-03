-- WealthTracker Database Schema
-- This migration creates all necessary tables for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (linked to Clerk authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}'
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'cash', 'investment', 'other')),
  currency TEXT DEFAULT 'GBP',
  balance DECIMAL(20, 2) DEFAULT 0,
  initial_balance DECIMAL(20, 2) DEFAULT 0,
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

-- Categories table (hierarchical)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('type', 'sub', 'detail')),
  type TEXT CHECK (type IN ('income', 'expense', 'transfer')),
  icon TEXT,
  color TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  date DATE NOT NULL,
  notes TEXT,
  tags TEXT[],
  is_recurring BOOLEAN DEFAULT false,
  recurring_template_id UUID,
  transfer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE,
  rollover_enabled BOOLEAN DEFAULT false,
  rollover_amount DECIMAL(20, 2) DEFAULT 0,
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold INTEGER DEFAULT 80,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
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
  auto_contribute BOOLEAN DEFAULT false,
  contribution_amount DECIMAL(20, 2),
  contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Recurring transactions templates
CREATE TABLE IF NOT EXISTS recurring_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  day_of_month INTEGER,
  day_of_week INTEGER,
  next_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Sync queue for offline changes
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  data JSONB NOT NULL,
  device_id TEXT,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_recurring_templates_user_id ON recurring_templates(user_id);
CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id, sync_status);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id, created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_templates_updated_at BEFORE UPDATE ON recurring_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own profile" ON users
  FOR ALL USING (auth.uid()::TEXT = clerk_id);

CREATE POLICY "Users can view own accounts" ON accounts
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own categories" ON categories
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own transactions" ON transactions
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own budgets" ON budgets
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own goals" ON goals
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own recurring templates" ON recurring_templates
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own tags" ON tags
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own sync queue" ON sync_queue
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

CREATE POLICY "Users can view own audit log" ON audit_log
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::TEXT));

-- Create default categories for new users (function)
CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS void AS $$
DECLARE
  income_type_id UUID;
  expense_type_id UUID;
  salary_sub_id UUID;
  housing_sub_id UUID;
  food_sub_id UUID;
  transport_sub_id UUID;
BEGIN
  -- Create type-level categories
  INSERT INTO categories (user_id, name, level, type, is_system) 
  VALUES (p_user_id, 'Income', 'type', 'income', true) 
  RETURNING id INTO income_type_id;
  
  INSERT INTO categories (user_id, name, level, type, is_system) 
  VALUES (p_user_id, 'Expense', 'type', 'expense', true) 
  RETURNING id INTO expense_type_id;
  
  INSERT INTO categories (user_id, name, level, type, is_system) 
  VALUES (p_user_id, 'Transfer', 'type', 'transfer', true);

  -- Create income sub-categories
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, income_type_id, 'Salary', 'sub', 'income', true) 
  RETURNING id INTO salary_sub_id;
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, income_type_id, 'Freelance', 'sub', 'income', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, income_type_id, 'Investment', 'sub', 'income', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, income_type_id, 'Other Income', 'sub', 'income', true);

  -- Create expense sub-categories
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Housing', 'sub', 'expense', true) 
  RETURNING id INTO housing_sub_id;
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Food & Dining', 'sub', 'expense', true) 
  RETURNING id INTO food_sub_id;
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Transportation', 'sub', 'expense', true) 
  RETURNING id INTO transport_sub_id;
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Shopping', 'sub', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Entertainment', 'sub', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Healthcare', 'sub', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, expense_type_id, 'Utilities', 'sub', 'expense', true);

  -- Create detail categories
  -- Housing details
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, housing_sub_id, 'Rent', 'detail', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, housing_sub_id, 'Mortgage', 'detail', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, housing_sub_id, 'Insurance', 'detail', 'expense', true);
  
  -- Food details
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, food_sub_id, 'Groceries', 'detail', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, food_sub_id, 'Restaurants', 'detail', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, food_sub_id, 'Takeout', 'detail', 'expense', true);
  
  -- Transport details
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, transport_sub_id, 'Public Transport', 'detail', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, transport_sub_id, 'Fuel', 'detail', 'expense', true);
  
  INSERT INTO categories (user_id, parent_id, name, level, type, is_system) 
  VALUES (p_user_id, transport_sub_id, 'Car Maintenance', 'detail', 'expense', true);
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default categories for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();