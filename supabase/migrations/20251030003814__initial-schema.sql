-- Initial Supabase Schema
-- Generated: 2025-10-30T10:46:52.479Z
-- Database: postgres
--
-- WARNING: This is a reconstructed schema based on application code analysis.
-- It may not include all database-level constraints, triggers, or RLS policies.
-- For a complete schema export, use pg_dump with direct database access.
--
-- Tables confirmed to exist: users, profiles, accounts, transactions, categories, budgets, budget_periods, goals, financial_plans, bills, investments, investment_transactions, tags, transaction_tags, import_rules
--

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clerk_id UUID,
  email VARCHAR(255),
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON public.users (clerk_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Table: accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  type VARCHAR(50),
  balance DECIMAL(19, 4),
  currency TEXT,
  institution TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.accounts ADD CONSTRAINT fk_accounts_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Table: transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  account_id UUID,
  category_id UUID,
  amount DECIMAL(19, 4),
  type VARCHAR(50),
  description TEXT,
  date TEXT,
  is_pending BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account_id FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_category_id FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Table: categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  type VARCHAR(50),
  icon TEXT,
  color TEXT,
  parent_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.categories ADD CONSTRAINT fk_categories_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD CONSTRAINT fk_categories_parent_id FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Table: budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  category_id UUID,
  amount DECIMAL(19, 4),
  period VARCHAR(50),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.budgets ADD CONSTRAINT fk_budgets_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.budgets ADD CONSTRAINT fk_budgets_category_id FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Table: budget_periods
CREATE TABLE IF NOT EXISTS public.budget_periods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  allocated_amount TEXT,
  spent_amount TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.budget_periods ADD CONSTRAINT fk_budget_periods_budget_id FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;

-- Table: goals
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  target_amount TEXT,
  current_amount TEXT,
  target_date TIMESTAMP WITH TIME ZONE,
  type VARCHAR(50),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.goals ADD CONSTRAINT fk_goals_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Table: financial_plans
CREATE TABLE IF NOT EXISTS public.financial_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  description TEXT,
  type VARCHAR(50),
  status VARCHAR(50),
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.financial_plans ADD CONSTRAINT fk_financial_plans_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Table: bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  amount DECIMAL(19, 4),
  due_date TIMESTAMP WITH TIME ZONE,
  frequency VARCHAR(50),
  category_id UUID,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.bills ADD CONSTRAINT fk_bills_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD CONSTRAINT fk_bills_category_id FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Table: investments
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  account_id UUID,
  symbol TEXT,
  name TEXT,
  quantity DECIMAL(19, 8),
  purchase_price DECIMAL(19, 4),
  current_price DECIMAL(19, 4),
  type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.investments ADD CONSTRAINT fk_investments_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.investments ADD CONSTRAINT fk_investments_account_id FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Table: investment_transactions
CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  investment_id UUID,
  type VARCHAR(50),
  quantity DECIMAL(19, 8),
  price TEXT,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.investment_transactions ADD CONSTRAINT fk_investment_transactions_investment_id FOREIGN KEY (investment_id) REFERENCES public.investments(id) ON DELETE CASCADE;

-- Table: tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.tags ADD CONSTRAINT fk_tags_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Table: transaction_tags
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID,
  tag_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.transaction_tags ADD CONSTRAINT fk_transaction_tags_transaction_id FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_tags ADD CONSTRAINT fk_transaction_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

-- Table: import_rules
CREATE TABLE IF NOT EXISTS public.import_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  name TEXT,
  pattern TEXT,
  category_id UUID,
  tags JSONB,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.import_rules ADD CONSTRAINT fk_import_rules_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.import_rules ADD CONSTRAINT fk_import_rules_category_id FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions table
-- Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can only insert their own transactions
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can only update their own transactions
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- CRITICAL: Users can only delete their own transactions (this was missing!)
CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Service role bypass for all operations
CREATE POLICY "Service role has full access" ON public.transactions
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for accounts
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass accounts" ON public.accounts
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for categories
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass categories" ON public.categories
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for budgets
CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass budgets" ON public.budgets
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for goals
CREATE POLICY "Users can view own goals" ON public.goals
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own goals" ON public.goals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own goals" ON public.goals
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own goals" ON public.goals
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass goals" ON public.goals
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for bills
CREATE POLICY "Users can view own bills" ON public.bills
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own bills" ON public.bills
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own bills" ON public.bills
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own bills" ON public.bills
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass bills" ON public.bills
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for investments
CREATE POLICY "Users can view own investments" ON public.investments
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own investments" ON public.investments
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own investments" ON public.investments
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own investments" ON public.investments
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass investments" ON public.investments
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for tags
CREATE POLICY "Users can view own tags" ON public.tags
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own tags" ON public.tags
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own tags" ON public.tags
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass tags" ON public.tags
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for import_rules
CREATE POLICY "Users can view own import_rules" ON public.import_rules
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own import_rules" ON public.import_rules
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own import_rules" ON public.import_rules
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own import_rules" ON public.import_rules
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass import_rules" ON public.import_rules
  USING (auth.jwt()->>'role' = 'service_role');
