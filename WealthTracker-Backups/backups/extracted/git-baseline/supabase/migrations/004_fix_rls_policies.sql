-- Fix Row Level Security policies for accounts table
-- This ensures users can properly create, read, update, and delete their own accounts

-- First, drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can create their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON accounts;

-- Enable RLS on accounts table if not already enabled
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Create new, more permissive policies for accounts
-- Note: Using auth.uid() returns the Supabase Auth user ID

-- Policy for SELECT (viewing accounts)
CREATE POLICY "Users can view their own accounts"
  ON accounts FOR SELECT
  USING (
    user_id::text = auth.uid()::text 
    OR 
    user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text)
  );

-- Policy for INSERT (creating new accounts)
CREATE POLICY "Users can create their own accounts"
  ON accounts FOR INSERT
  WITH CHECK (
    user_id::text = auth.uid()::text 
    OR 
    user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text)
  );

-- Policy for UPDATE (modifying accounts)
CREATE POLICY "Users can update their own accounts"
  ON accounts FOR UPDATE
  USING (
    user_id::text = auth.uid()::text 
    OR 
    user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text)
  );

-- Policy for DELETE (removing accounts)
CREATE POLICY "Users can delete their own accounts"
  ON accounts FOR DELETE
  USING (
    user_id::text = auth.uid()::text 
    OR 
    user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text)
  );

-- Also fix policies for users table to ensure we can query it
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (
    id::text = auth.uid()::text 
    OR 
    clerk_user_id = auth.uid()::text
  );

-- Allow users to create their profile
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (
    id::text = auth.uid()::text 
    OR 
    clerk_user_id = auth.uid()::text
  );

-- Allow users to update their profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (
    id::text = auth.uid()::text 
    OR 
    clerk_user_id = auth.uid()::text
  );

-- Grant necessary permissions
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Test the policies are working
SELECT COUNT(*) as policy_count FROM pg_policies WHERE tablename IN ('accounts', 'users');