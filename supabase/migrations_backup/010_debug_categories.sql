-- Debug: Let's check if the categories table and column exist

-- 1. Check if categories table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'categories'
);

-- 2. Check columns in categories table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- 3. Check if we can reference categories.id
SELECT id FROM categories LIMIT 1;

-- 4. Try creating a simple test table with category reference
CREATE TABLE IF NOT EXISTS test_category_ref (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id)
);

-- 5. If test table created successfully, drop it
DROP TABLE IF EXISTS test_category_ref;