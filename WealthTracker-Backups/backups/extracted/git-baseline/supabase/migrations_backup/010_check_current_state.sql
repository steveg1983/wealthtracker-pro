-- Let's check what actually exists in the database right now

-- 1. Check if goals table exists and what columns it has
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'goals'
ORDER BY ordinal_position;

-- 2. Check if budgets table exists and what columns it has
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'budgets'
ORDER BY ordinal_position;

-- 3. Check what constraints exist on goals table
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'goals'::regclass;

-- 4. Check what constraints exist on budgets table
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'budgets'::regclass;