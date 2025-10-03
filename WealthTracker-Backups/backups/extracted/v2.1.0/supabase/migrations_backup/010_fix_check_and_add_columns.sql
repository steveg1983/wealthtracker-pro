-- First, let's check what columns exist in the transactions table
-- Run this query to see the current structure:

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
ORDER BY ordinal_position;

-- If category_id and type columns are missing, run this block:
-- Note: You may need to run these one at a time if they fail together

-- Add category_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category_id UUID;
    ALTER TABLE transactions ADD CONSTRAINT fk_transactions_category 
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'type'
  ) THEN
    ALTER TABLE transactions ADD COLUMN type TEXT;
    ALTER TABLE transactions ADD CONSTRAINT check_transaction_type 
      CHECK (type IN ('income', 'expense', 'transfer'));
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);