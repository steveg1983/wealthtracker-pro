-- Verification queries to run in Supabase SQL Editor

-- 1. Check if categories table exists and has data
SELECT COUNT(*) as total_categories FROM categories;

-- 2. Check category structure
SELECT 
  level,
  type,
  COUNT(*) as count
FROM categories
GROUP BY level, type
ORDER BY level, type;

-- 3. Check if transfer categories were created for accounts
SELECT 
  a.name as account_name,
  c.name as transfer_category_name,
  c.is_transfer_category
FROM accounts a
LEFT JOIN categories c ON c.account_id = a.id
WHERE a.is_active = TRUE
ORDER BY a.name;

-- 4. Check if the trigger function exists
SELECT 
  routine_name
FROM information_schema.routines
WHERE routine_name = 'create_transfer_category_for_account';

-- 5. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'create_transfer_category_on_account_insert';