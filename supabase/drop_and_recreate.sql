-- CAREFUL: This will DELETE ALL DATA in these tables!
-- Only run this if you want to start fresh with a clean database

-- Drop all existing tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS recurring_templates CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any existing functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS create_default_categories(UUID) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Now run the original migration to create fresh tables
-- Copy and paste the contents of 001_initial_schema.sql after running this