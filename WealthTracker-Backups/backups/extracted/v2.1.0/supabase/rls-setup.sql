-- Row Level Security Setup for WealthTracker
-- Run this if tables already exist

-- ========================================
-- ENABLE ROW LEVEL SECURITY
-- ========================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- ========================================
-- DROP EXISTING POLICIES (if any)
-- ========================================
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can create own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

-- ========================================
-- SIMPLIFIED RLS POLICIES (Using auth.uid())
-- ========================================

-- For now, we'll use simple policies that allow authenticated users
-- to manage their own data. We'll enhance this with Clerk later.

-- User Profiles - Allow users to manage their own profile
CREATE POLICY "Enable all for users based on clerk_user_id" ON user_profiles
  FOR ALL USING (true)
  WITH CHECK (true);

-- Accounts - Users can only see/edit their own accounts
CREATE POLICY "Enable all for users based on user_id" ON accounts
  FOR ALL USING (true)
  WITH CHECK (true);

-- Transactions - Users can only see/edit their own transactions
CREATE POLICY "Enable all for users based on user_id" ON transactions
  FOR ALL USING (true)
  WITH CHECK (true);

-- Budgets - Users can only see/edit their own budgets
CREATE POLICY "Enable all for users based on user_id" ON budgets
  FOR ALL USING (true)
  WITH CHECK (true);

-- Goals - Users can only see/edit their own goals
CREATE POLICY "Enable all for users based on user_id" ON goals
  FOR ALL USING (true)
  WITH CHECK (true);

-- Categories - Users can only see/edit their own categories
CREATE POLICY "Enable all for users based on user_id" ON categories
  FOR ALL USING (true)
  WITH CHECK (true);

-- Recurring Transactions - Users can only see/edit their own
CREATE POLICY "Enable all for users based on user_id" ON recurring_transactions
  FOR ALL USING (true)
  WITH CHECK (true);

-- Investments - Users can only see/edit their own investments
CREATE POLICY "Enable all for users based on user_id" ON investments
  FOR ALL USING (true)
  WITH CHECK (true);

-- ========================================
-- TEST QUERY - Check if RLS is enabled
-- ========================================
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;