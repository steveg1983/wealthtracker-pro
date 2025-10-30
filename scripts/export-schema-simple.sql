-- Simplified Schema Export for Supabase Dashboard
-- Run each section separately and save the results

-- 1. Get all table definitions as CREATE TABLE statements
WITH table_columns AS (
    SELECT
        c.table_name,
        string_agg(
            '    ' || c.column_name || ' ' ||
            CASE
                WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
                WHEN c.data_type = 'ARRAY' THEN REPLACE(c.udt_name, '_', '') || '[]'
                WHEN c.character_maximum_length IS NOT NULL
                    THEN c.data_type || '(' || c.character_maximum_length || ')'
                WHEN c.numeric_precision IS NOT NULL
                    THEN c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
                ELSE c.data_type
            END ||
            CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END ||
            CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
            E',\n' ORDER BY c.ordinal_position
        ) AS column_definitions
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    GROUP BY c.table_name
)
SELECT
    '-- Table: ' || table_name || E'\n' ||
    'CREATE TABLE IF NOT EXISTS public.' || table_name || ' (' || E'\n' ||
    column_definitions || E'\n' ||
    ');' || E'\n' as create_statement
FROM table_columns
ORDER BY table_name;

-- 2. Get all constraints (Primary Keys, Foreign Keys, Unique)
SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name || ' ' ||
    CASE
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN
            'PRIMARY KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ')'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN
            'FOREIGN KEY (' || string_agg(DISTINCT kcu.column_name, ', ') || ') REFERENCES ' ||
            ccu.table_name || '(' || string_agg(DISTINCT ccu.column_name, ', ') || ')'
        WHEN tc.constraint_type = 'UNIQUE' THEN
            'UNIQUE (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ')'
        WHEN tc.constraint_type = 'CHECK' THEN
            'CHECK (' || cc.check_clause || ')'
    END || ';' as constraint_statement
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.check_constraints cc
    ON cc.constraint_name = tc.constraint_name
    AND cc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
GROUP BY tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type, ccu.table_name, cc.check_clause
ORDER BY tc.table_name, tc.constraint_type;

-- 3. Get all indexes
SELECT
    'CREATE INDEX IF NOT EXISTS ' || indexname ||
    ' ON public.' || tablename ||
    ' ' || REPLACE(REPLACE(indexdef, 'CREATE INDEX ' || indexname || ' ON public.' || tablename, ''), 'CREATE UNIQUE INDEX ' || indexname || ' ON public.' || tablename, '') || ';' as index_statement
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'  -- Exclude primary key indexes
    AND indexname NOT LIKE '%_key'   -- Exclude unique constraint indexes
ORDER BY tablename, indexname;

-- 4. Get RLS policies
SELECT
    '-- Enable RLS on ' || tablename || E'\n' ||
    'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' || E'\n\n' ||
    string_agg(
        'CREATE POLICY "' || policyname || '"' || E'\n' ||
        '  ON public.' || tablename || E'\n' ||
        '  AS ' || CASE permissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END || E'\n' ||
        '  FOR ' || cmd || E'\n' ||
        CASE WHEN roles::text != '{public}' THEN '  TO ' || array_to_string(roles, ', ') || E'\n' ELSE '' END ||
        CASE WHEN qual IS NOT NULL THEN '  USING (' || qual || ')' || E'\n' ELSE '' END ||
        CASE WHEN with_check IS NOT NULL THEN '  WITH CHECK (' || with_check || ')' ELSE '' END ||
        ';',
        E'\n\n'
    ) as rls_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 5. Get functions and triggers
SELECT
    'CREATE OR REPLACE FUNCTION ' || routine_schema || '.' || routine_name || '(' ||
    COALESCE(string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position), '') ||
    ') RETURNS ' || data_type || E'\n' ||
    'LANGUAGE ' || external_language || E'\n' ||
    'AS $function$' || E'\n' ||
    routine_definition || E'\n' ||
    '$function$;' as function_statement
FROM information_schema.routines
LEFT JOIN information_schema.parameters
    ON routines.specific_name = parameters.specific_name
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
GROUP BY routine_schema, routine_name, data_type, external_language, routine_definition
ORDER BY routine_name;

-- 6. Get table row counts (for reference)
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;