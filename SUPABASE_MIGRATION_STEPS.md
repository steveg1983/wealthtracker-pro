# Supabase Migration Steps - Fix UUID Issues

## Problem
Your database expects UUID types for user_id columns, but Clerk provides string IDs like `user_31NgYqWomiEWQXfoNHEVuJqrwRR`.

## Solution
Run these SQL scripts in your Supabase SQL Editor **in this exact order**:

## Step 1: Check What Tables Exist
**File:** `/supabase/check-tables.sql`

Run this FIRST to see what tables and policies already exist:
```sql
-- This will show you:
-- 1. All existing tables
-- 2. Current column types
-- 3. Existing RLS policies
```

## Step 2: Run UUID Migration V3
**File:** `/supabase/fix-uuid-migration-v3.sql`

This is the FIXED version that handles existing policies properly:

```sql
-- This script will:
-- 1. Drop ALL RLS policies FIRST (to avoid conflicts)
-- 2. Drop foreign key constraints
-- 3. Convert user_id columns from UUID to TEXT
-- 4. Re-add foreign keys pointing to clerk_user_id
-- 5. Recreate RLS policies
-- 6. Show verification results
```

**Important:** This V3 script fixes the policy conflict issues you encountered.

## How to Run in Supabase:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `/supabase/check-tables.sql`
6. Click **Run** to see what exists
7. Create a new query
8. Copy and paste the contents of `/supabase/fix-uuid-migration-v3.sql`
9. Click **Run**

## What This Fixes:

✅ Allows Clerk string IDs to be stored directly  
✅ Maintains referential integrity with foreign keys  
✅ Updates Row Level Security policies  
✅ Creates missing subscription tables  

## After Migration:

Test that everything works:
1. Log in to your app
2. Check that your user profile is created
3. Try creating an account
4. Try adding a transaction

## If You Get Errors:

### "policy already exists"
- This means the first script already created some tables
- The V3 migration script handles this by dropping policies first

### "cannot alter type of column used in policy"
- The V3 script fixes this by dropping policies before altering columns

### "foreign key violation"
- Your user_profiles table might be empty
- Log out and log back in to create a profile

### "row violates row-level security policy"
- The RLS policies need the Clerk user ID to be set
- Make sure you're logged in with Clerk

## Rollback (if needed):

If something goes wrong, you can revert by:
1. Changing the columns back to UUID type
2. Re-creating the original foreign keys
3. But this will only work if you haven't inserted any Clerk string IDs yet

## Optional: Create Missing Tables

If the check-tables script shows you're missing subscription tables, you can create them:

**File:** `/supabase/create-missing-tables.sql`

But note: This might fail with "policy already exists" if some tables were already created. That's OK - the V3 migration handles this.

## Success Indicators:

After running the migration, the verification queries should show:
- Foreign keys pointing to `clerk_user_id` column
- User_id columns with `text` data type
- RLS policies using the current user setting