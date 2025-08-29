-- Add transfer category fields to categories table
-- These fields enable dynamic transfer categories per account

-- Add is_transfer_category column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' 
    AND column_name = 'is_transfer_category'
  ) THEN
    ALTER TABLE categories 
    ADD COLUMN is_transfer_category BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add account_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' 
    AND column_name = 'account_id'
  ) THEN
    ALTER TABLE categories 
    ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add is_active column if it doesn't exist (for soft deletes)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE categories 
    ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Create index for faster lookups of transfer categories
CREATE INDEX IF NOT EXISTS idx_categories_account_id ON categories(account_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_transfer ON categories(is_transfer_category);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Create a function to automatically create transfer categories for new accounts
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

-- Create trigger for new accounts (only if it doesn't exist)
DROP TRIGGER IF EXISTS create_transfer_category_on_account_insert ON accounts;
CREATE TRIGGER create_transfer_category_on_account_insert
  AFTER INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION create_transfer_category_for_account();

-- Create transfer categories for all existing accounts that don't have them
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

-- Update RLS policies to include the new columns
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()
    )
    AND (is_active = TRUE OR is_active IS NULL)  -- Only show active categories
  );