-- Diagnose the REAL issue with categories table

-- 1. Check what schema the categories table is in
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'categories';

-- 2. Check if categories.id is actually a primary key
SELECT 
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'categories';

-- 3. Check current schema search path
SHOW search_path;

-- 4. Try to create the foreign key with explicit schema
-- First, let's see what schema users table is in
SELECT 
    table_schema,
    table_name
FROM information_schema.tables 
WHERE table_name = 'users';

-- 5. Check if we can manually add a foreign key constraint
ALTER TABLE budgets 
ADD CONSTRAINT fk_budgets_category 
FOREIGN KEY (category_id) 
REFERENCES public.categories(id) ON DELETE SET NULL;

-- If that fails, try without schema
ALTER TABLE budgets 
ADD CONSTRAINT fk_budgets_category 
FOREIGN KEY (category_id) 
REFERENCES categories(id) ON DELETE SET NULL;