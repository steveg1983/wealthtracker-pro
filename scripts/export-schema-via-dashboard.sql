-- Complete Schema Export Query for Supabase Dashboard
-- Run this in SQL Editor and export the results
-- This will give you most of the schema information

-- Set output format
\set QUIET on
\pset format unaligned
\pset tuples_only on
\pset footer off

-- Start transaction
BEGIN;

-- 1. Database Extensions
SELECT '-- Extensions' as info
UNION ALL
SELECT 'CREATE EXTENSION IF NOT EXISTS "' || extname || '";'
FROM pg_extension
WHERE extname NOT IN ('plpgsql', 'pg_catalog', 'information_schema');

-- 2. Tables with full definitions
SELECT '' UNION ALL SELECT '-- Tables' as info
UNION ALL
SELECT
    'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' || E'\n' ||
    string_agg(
        '    ' || column_name || ' ' ||
        CASE
            WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
            WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
            ELSE data_type
        END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        E',\n' ORDER BY ordinal_position
    ) || E'\n);'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename;

-- 3. Primary Keys
SELECT '' UNION ALL SELECT '-- Primary Keys' as info
UNION ALL
SELECT
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' PRIMARY KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
GROUP BY tc.table_schema, tc.table_name, tc.constraint_name;

-- 4. Foreign Keys
SELECT '' UNION ALL SELECT '-- Foreign Keys' as info
UNION ALL
SELECT
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || ') REFERENCES ' ||
    ccu.table_schema || '.' || ccu.table_name || '(' || ccu.column_name || ')' ||
    CASE
        WHEN rc.delete_rule != 'NO ACTION' THEN ' ON DELETE ' || rc.delete_rule
        ELSE ''
    END ||
    CASE
        WHEN rc.update_rule != 'NO ACTION' THEN ' ON UPDATE ' || rc.update_rule
        ELSE ''
    END || ';'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';

-- 5. Indexes
SELECT '' UNION ALL SELECT '-- Indexes' as info
UNION ALL
SELECT indexdef || ';'
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
    );

-- 6. RLS Policies
SELECT '' UNION ALL SELECT '-- Row Level Security' as info
UNION ALL
SELECT 'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;'
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename;

SELECT '' UNION ALL SELECT '-- RLS Policies' as info
UNION ALL
SELECT
    'CREATE POLICY "' || policyname || '" ON ' ||
    schemaname || '.' || tablename ||
    ' AS ' || CASE permissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END ||
    ' FOR ' || cmd ||
    CASE WHEN roles::text != '{public}' THEN ' TO ' || array_to_string(roles, ', ') ELSE '' END ||
    CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END || ';'
FROM pg_policies
WHERE schemaname = 'public';

-- 7. Functions
SELECT '' UNION ALL SELECT '-- Functions' as info
UNION ALL
SELECT
    'CREATE OR REPLACE FUNCTION ' || ns.nspname || '.' || p.proname || '(' ||
    pg_get_function_arguments(p.oid) || ')' ||
    ' RETURNS ' || pg_get_function_result(p.oid) ||
    ' LANGUAGE ' || l.lanname ||
    CASE WHEN p.provolatile = 'i' THEN ' IMMUTABLE'
         WHEN p.provolatile = 's' THEN ' STABLE'
         ELSE '' END ||
    ' AS $function$' || p.prosrc || '$function$;'
FROM pg_proc p
JOIN pg_namespace ns ON p.pronamespace = ns.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE ns.nspname = 'public'
    AND l.lanname != 'internal';

-- 8. Triggers
SELECT '' UNION ALL SELECT '-- Triggers' as info
UNION ALL
SELECT
    'CREATE TRIGGER ' || trigger_name || ' ' ||
    action_timing || ' ' ||
    string_agg(event_manipulation, ' OR ') || ' ON ' ||
    event_object_schema || '.' || event_object_table ||
    CASE WHEN action_orientation = 'ROW' THEN ' FOR EACH ROW' ELSE ' FOR EACH STATEMENT' END ||
    ' EXECUTE FUNCTION ' || action_statement || ';'
FROM information_schema.triggers
WHERE trigger_schema = 'public'
GROUP BY trigger_schema, trigger_name, event_object_schema, event_object_table,
         action_timing, action_orientation, action_statement;

-- 9. Views
SELECT '' UNION ALL SELECT '-- Views' as info
UNION ALL
SELECT
    'CREATE OR REPLACE VIEW ' || schemaname || '.' || viewname || ' AS ' ||
    definition
FROM pg_views
WHERE schemaname = 'public';

-- 10. Materialized Views
SELECT '' UNION ALL SELECT '-- Materialized Views' as info
UNION ALL
SELECT
    'CREATE MATERIALIZED VIEW ' || schemaname || '.' || matviewname || ' AS ' ||
    definition || ';'
FROM pg_matviews
WHERE schemaname = 'public';

-- 11. Sequences
SELECT '' UNION ALL SELECT '-- Sequences' as info
UNION ALL
SELECT
    'CREATE SEQUENCE IF NOT EXISTS ' || sequence_schema || '.' || sequence_name ||
    ' INCREMENT BY ' || increment ||
    CASE WHEN minimum_value IS NOT NULL THEN ' MINVALUE ' || minimum_value ELSE ' NO MINVALUE' END ||
    CASE WHEN maximum_value IS NOT NULL THEN ' MAXVALUE ' || maximum_value ELSE ' NO MAXVALUE' END ||
    ' START WITH ' || start_value ||
    CASE WHEN cycle_option = 'YES' THEN ' CYCLE' ELSE ' NO CYCLE' END || ';'
FROM information_schema.sequences
WHERE sequence_schema = 'public';

-- 12. Comments
SELECT '' UNION ALL SELECT '-- Comments' as info
UNION ALL
SELECT
    'COMMENT ON TABLE ' || schemaname || '.' || tablename || ' IS ' ||
    quote_literal(obj_description(c.oid)) || ';'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND obj_description(c.oid) IS NOT NULL;

ROLLBACK;

-- Reset output format
\unset QUIET
\pset format aligned
\pset tuples_only off
\pset footer on