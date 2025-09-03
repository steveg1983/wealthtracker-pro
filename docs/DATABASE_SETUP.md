# Database Setup & SQL Execution Guide

## Overview
WealthTracker uses **Supabase** (PostgreSQL) as its database. There are multiple ways to run SQL commands depending on your needs.

## Where to Run SQL Commands

### Option 1: Supabase Dashboard (Recommended for Quick Queries)
1. **Go to your Supabase Dashboard**
   - Visit https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - You'll see a query editor interface

3. **Run your SQL**
   - Paste your SQL commands
   - Click "Run" or press `Cmd/Ctrl + Enter`
   - Results appear below

**Best for:** Quick queries, testing, one-off commands

### Option 2: Supabase CLI (Recommended for Migrations)
1. **Install Supabase CLI** (if not already installed)
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # npm/npx
   npm install -g supabase
   ```

2. **Initialize Supabase** (if not already done)
   ```bash
   supabase init
   ```

3. **Link to your project**
   ```bash
   supabase link --project-ref your-project-id
   # You'll find project-id in your Supabase URL: https://[project-id].supabase.co
   ```

4. **Run migrations**
   ```bash
   # Run all pending migrations
   supabase db push
   
   # Create a new migration
   supabase migration new your_migration_name
   
   # Run a specific SQL file
   supabase db push --file path/to/your.sql
   ```

**Best for:** Version-controlled migrations, team collaboration, CI/CD

### Option 3: Direct PostgreSQL Connection
1. **Get your connection string**
   - Go to Supabase Dashboard → Settings → Database
   - Copy the connection string

2. **Use a PostgreSQL client**
   ```bash
   # Using psql (command line)
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres"
   
   # Or use a GUI tool:
   # - TablePlus
   # - pgAdmin
   # - DBeaver
   # - Postico
   ```

**Best for:** Complex database operations, bulk data imports

### Option 4: From Your Application Code
```typescript
// Using Supabase client in your app
import { supabase } from './lib/supabaseClient';

// Run raw SQL (requires service role key - server-side only!)
const { data, error } = await supabase
  .rpc('your_function_name', { param1: 'value' });

// For security, complex SQL should be in database functions
```

**Best for:** Application logic, stored procedures

## Migration Files in Your Project

Your SQL migrations are located in:
```
/supabase/migrations/
├── 010_budgets_goals_investments.sql
├── 015_financial_planning_tables.sql
├── 016_dashboard_layouts.sql
└── ... other migrations
```

### To run these migrations:

#### Method 1: Via Supabase Dashboard
1. Open SQL Editor in Supabase Dashboard
2. Open the migration file (e.g., `010_budgets_goals_investments.sql`)
3. Copy the entire contents
4. Paste into SQL Editor
5. Click "Run"

#### Method 2: Via Supabase CLI
```bash
# Make sure you're in the project root
cd /Users/stevegreen/wealthtracker-web

# Push all migrations
supabase db push

# Or run a specific migration
supabase db push --file supabase/migrations/010_budgets_goals_investments.sql
```

## Common SQL Tasks

### Check if tables exist
```sql
-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check specific table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'budgets'
);
```

### View table structure
```sql
-- Describe table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'budgets';
```

### Check migration status
```sql
-- If using Supabase migrations
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

## Troubleshooting

### Error: "permission denied"
- Make sure you're using the correct role
- In Supabase Dashboard, you're automatically authenticated
- For CLI, ensure your credentials are correct

### Error: "relation already exists"
- The table/index/constraint already exists
- Check with: `SELECT * FROM pg_tables WHERE tablename = 'your_table';`
- Drop if needed: `DROP TABLE IF EXISTS your_table CASCADE;`

### Error: "violates foreign key constraint"
- You're trying to reference a non-existent record
- Check the parent table has the required data
- Or temporarily disable constraints (careful!):
  ```sql
  SET session_replication_role = 'replica';
  -- Your SQL here
  SET session_replication_role = 'origin';
  ```

## Best Practices

1. **Always backup before major changes**
   ```bash
   # Export your database
   supabase db dump -f backup.sql
   ```

2. **Test migrations locally first**
   ```bash
   # Start local Supabase
   supabase start
   
   # Test your migration
   supabase db push --file your_migration.sql
   
   # If good, push to production
   supabase db push --file your_migration.sql --remote
   ```

3. **Use transactions for multiple operations**
   ```sql
   BEGIN;
   -- Your SQL commands
   COMMIT; -- or ROLLBACK if something goes wrong
   ```

4. **Version your migrations**
   - Name files with numbers: `001_initial.sql`, `002_add_users.sql`
   - Keep migrations idempotent (safe to run multiple times)
   - Use `IF NOT EXISTS` clauses

## Quick Start Checklist

- [ ] Have Supabase project URL and anon key in `.env.local`
- [ ] Can access Supabase Dashboard
- [ ] Supabase CLI installed (optional but recommended)
- [ ] PostgreSQL client installed (optional)
- [ ] Know which migration files to run

## Next Steps

1. **Check your current database state**
   - Go to Supabase Dashboard → Table Editor
   - See what tables already exist

2. **Run pending migrations**
   - Check `/supabase/migrations/` folder
   - Run them in order (010, 015, 016, etc.)

3. **Verify the setup**
   - Check tables were created
   - Test with sample queries
   - Ensure app can connect

Need help? Check the Supabase docs: https://supabase.com/docs