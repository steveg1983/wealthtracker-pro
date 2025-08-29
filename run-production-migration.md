# Production Migration Instructions

## IMPORTANT: Run these migrations on your production Supabase database

The code has been deployed to Vercel, but you need to run the database migrations to complete the setup.

### Steps to Run Migrations:

1. **Go to your Supabase Dashboard**
   - Navigate to https://app.supabase.com
   - Select your WealthTracker project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Migration #1 - Create Categories Table** (REQUIRED - Run this first!)
   - Copy the entire contents of `supabase/migrations/009_create_categories_table.sql`
   - Paste it into the SQL editor
   - Click "Run" button
   - This creates the categories table and populates it with default categories

4. **Verify Categories Table Exists**
   - Run this query to verify: `SELECT COUNT(*) FROM categories;`
   - You should see a count of categories created

### What Migration #1 Does:

1. **Creates the complete categories table** with all necessary columns:
   - Standard category fields (name, type, level, parent_id)
   - Transfer category fields (is_transfer_category, account_id)
   - Soft-delete support (is_active)

2. **Creates indexes** for better performance

3. **Sets up RLS (Row Level Security)** policies

4. **Creates a trigger** that automatically creates transfer categories for new accounts

5. **Populates default categories** for all existing users:
   - Income, Expense, Transfer type categories
   - Common sub-categories (Housing, Food, Transport, etc.)
   - Basic detail categories (Rent, Groceries, Fuel, etc.)

6. **Creates transfer categories** for all existing accounts

### Verification:

After running the migration, verify that:
1. Check the categories table has the new columns
2. Each existing account should now have a "To/From [Account Name]" category
3. Creating a new account should automatically create its transfer category
4. The production website should now show correct categories in dropdowns

### Troubleshooting:

If you encounter errors:
- Make sure you're connected to the correct database
- Check that the accounts table exists and has data
- Verify that the categories table exists

The migration is designed to be idempotent (safe to run multiple times).