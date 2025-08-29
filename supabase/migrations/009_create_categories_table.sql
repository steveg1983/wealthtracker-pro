-- Create categories table if it doesn't exist
-- This migration creates the complete categories table with all necessary fields

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  level TEXT NOT NULL CHECK (level IN ('type', 'sub', 'detail')),
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  color TEXT,
  icon TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  is_transfer_category BOOLEAN DEFAULT FALSE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, parent_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_account_id ON categories(account_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_transfer ON categories(is_transfer_category);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Note: We're temporarily disabling RLS enforcement until we can properly set up auth
-- The auth.uid() doesn't work with Clerk authentication
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (TRUE);  -- Temporarily allow all reads

DROP POLICY IF EXISTS "Users can create own categories" ON categories;
CREATE POLICY "Users can create own categories" ON categories
  FOR INSERT WITH CHECK (TRUE);  -- Temporarily allow all inserts

DROP POLICY IF EXISTS "Users can update own categories" ON categories;
CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (TRUE);  -- Temporarily allow all updates

DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (TRUE);  -- Temporarily allow all deletes

-- Create function to automatically create transfer categories for new accounts
CREATE OR REPLACE FUNCTION create_transfer_category_for_account()
RETURNS TRIGGER AS $$
DECLARE
  transfer_type_id UUID;
BEGIN
  -- Find the Transfer type category for this user
  SELECT id INTO transfer_type_id
  FROM categories
  WHERE user_id = NEW.user_id
    AND name = 'Transfer'
    AND level = 'type'
  LIMIT 1;
  
  -- Create the transfer category for this account
  INSERT INTO categories (
    user_id,
    name,
    type,
    level,
    parent_id,
    is_system,
    is_transfer_category,
    account_id,
    is_active
  ) VALUES (
    NEW.user_id,
    'To/From ' || NEW.name,
    'both',
    'detail',
    transfer_type_id,
    FALSE,
    TRUE,
    NEW.id,
    TRUE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new accounts
DROP TRIGGER IF EXISTS create_transfer_category_on_account_insert ON accounts;
CREATE TRIGGER create_transfer_category_on_account_insert
  AFTER INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION create_transfer_category_for_account();

-- Create default categories for all existing users
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT DISTINCT 
  u.id as user_id,
  'Income' as name,
  'income' as type,
  'type' as level,
  NULL as parent_id,
  true as is_system
FROM users u
LEFT JOIN categories c ON c.user_id = u.id AND c.name = 'Income' AND c.level = 'type'
WHERE c.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT DISTINCT 
  u.id as user_id,
  'Expense' as name,
  'expense' as type,
  'type' as level,
  NULL as parent_id,
  true as is_system
FROM users u
LEFT JOIN categories c ON c.user_id = u.id AND c.name = 'Expense' AND c.level = 'type'
WHERE c.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT DISTINCT 
  u.id as user_id,
  'Transfer' as name,
  'both' as type,
  'type' as level,
  NULL as parent_id,
  true as is_system
FROM users u
LEFT JOIN categories c ON c.user_id = u.id AND c.name = 'Transfer' AND c.level = 'type'
WHERE c.id IS NULL;

-- Create some basic sub-categories for existing users
-- Income sub-categories
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Salary & Wages' as name,
  'income' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Salary & Wages' AND sub.level = 'sub'
WHERE c.name = 'Income' AND c.level = 'type' AND sub.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Other Income' as name,
  'income' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Other Income' AND sub.level = 'sub'
WHERE c.name = 'Income' AND c.level = 'type' AND sub.id IS NULL;

-- Expense sub-categories
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Housing' as name,
  'expense' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Housing' AND sub.level = 'sub'
WHERE c.name = 'Expense' AND c.level = 'type' AND sub.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Food & Dining' as name,
  'expense' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Food & Dining' AND sub.level = 'sub'
WHERE c.name = 'Expense' AND c.level = 'type' AND sub.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Transport' as name,
  'expense' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Transport' AND sub.level = 'sub'
WHERE c.name = 'Expense' AND c.level = 'type' AND sub.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Utilities' as name,
  'expense' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Utilities' AND sub.level = 'sub'
WHERE c.name = 'Expense' AND c.level = 'type' AND sub.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Other Expenses' as name,
  'expense' as type,
  'sub' as level,
  c.id as parent_id,
  true as is_system
FROM categories c
LEFT JOIN categories sub ON sub.user_id = c.user_id AND sub.name = 'Other Expenses' AND sub.level = 'sub'
WHERE c.name = 'Expense' AND c.level = 'type' AND sub.id IS NULL;

-- Create basic detail categories
-- Salary detail
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Salary' as name,
  'income' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Salary' AND d.level = 'detail'
WHERE c.name = 'Salary & Wages' AND c.level = 'sub' AND d.id IS NULL;

-- Housing details
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Rent' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Rent' AND d.level = 'detail'
WHERE c.name = 'Housing' AND c.level = 'sub' AND d.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Mortgage' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Mortgage' AND d.level = 'detail'
WHERE c.name = 'Housing' AND c.level = 'sub' AND d.id IS NULL;

-- Food details
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Groceries' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Groceries' AND d.level = 'detail'
WHERE c.name = 'Food & Dining' AND c.level = 'sub' AND d.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Restaurants' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Restaurants' AND d.level = 'detail'
WHERE c.name = 'Food & Dining' AND c.level = 'sub' AND d.id IS NULL;

-- Transport details
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Fuel' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Fuel' AND d.level = 'detail'
WHERE c.name = 'Transport' AND c.level = 'sub' AND d.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Public Transport' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Public Transport' AND d.level = 'detail'
WHERE c.name = 'Transport' AND c.level = 'sub' AND d.id IS NULL;

-- Utilities details
INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Electricity' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Electricity' AND d.level = 'detail'
WHERE c.name = 'Utilities' AND c.level = 'sub' AND d.id IS NULL;

INSERT INTO categories (user_id, name, type, level, parent_id, is_system)
SELECT 
  c.user_id,
  'Internet' as name,
  'expense' as type,
  'detail' as level,
  c.id as parent_id,
  false as is_system
FROM categories c
LEFT JOIN categories d ON d.user_id = c.user_id AND d.name = 'Internet' AND d.level = 'detail'
WHERE c.name = 'Utilities' AND c.level = 'sub' AND d.id IS NULL;

-- Now create transfer categories for all existing accounts
INSERT INTO categories (
  user_id,
  name,
  type,
  level,
  parent_id,
  is_system,
  is_transfer_category,
  account_id,
  is_active
)
SELECT 
  a.user_id,
  'To/From ' || a.name,
  'both',
  'detail',
  c.id,
  FALSE,
  TRUE,
  a.id,
  TRUE
FROM accounts a
LEFT JOIN categories tc ON tc.account_id = a.id AND tc.is_transfer_category = TRUE
LEFT JOIN categories c ON c.user_id = a.user_id AND c.name = 'Transfer' AND c.level = 'type'
WHERE tc.id IS NULL  -- Only create if transfer category doesn't exist
  AND a.is_active = TRUE;  -- Only for active accounts

-- Grant permissions for service role
GRANT ALL ON categories TO service_role;