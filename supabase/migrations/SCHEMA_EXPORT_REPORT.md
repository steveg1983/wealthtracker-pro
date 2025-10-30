# Supabase Schema Export Report
**Date**: 2025-10-30
**Engineer**: Claude

## Summary

Attempted to capture the baseline Supabase schema to create the first migration file. While we successfully verified connectivity and identified 14 tables in the database, we cannot export the complete schema (with RLS policies, triggers, and constraints) without the database password from the Supabase dashboard.

## Current Status

### ✅ Completed
1. **Verified Supabase CLI installation**: v2.54.11 available via npx
2. **Confirmed database connectivity**: Successfully connected using service role key
3. **Identified existing tables** (14 total):
   - profiles
   - accounts
   - transactions
   - categories
   - budgets
   - budget_periods
   - goals
   - financial_plans
   - bills
   - investments
   - investment_transactions
   - tags
   - transaction_tags
   - import_rules

4. **Created helper scripts**:
   - `scripts/export-schema.mjs` - Initial attempt to export schema
   - `scripts/export-schema-via-api.mjs` - Successfully lists tables and creates placeholder migration

5. **Generated placeholder migration**:
   - `supabase/migrations/20251030003814__initial-schema-placeholder.sql`
   - Contains instructions for completing the full schema export

### ⚠️ Critical Finding: RLS Policy Issue

The smoke test revealed a **security vulnerability**:
- **Issue**: Anonymous users can delete transactions (should be blocked by RLS)
- **Test**: `src/test/supabase/supabase-smoke.test.ts` - "enforces RLS by blocking anon deletion" FAILS
- **Impact**: Row Level Security policies for DELETE operations may be missing or misconfigured
- **Action Required**: This needs to be fixed in the schema before production deployment

## Required Actions

To complete the schema export, you need to:

1. **Get the database password** from Supabase Dashboard:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Navigate to Settings → Database → Connection string
   - Copy the password from the connection string

2. **Export the database URL**:
   ```bash
   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.nqbacrjjgdjabygqtcah.supabase.co:5432/postgres"
   ```

3. **Run the full schema dump**:
   ```bash
   npx supabase db dump \
     --db-url "$SUPABASE_DB_URL" \
     --schema public \
     --data false \
     --file "supabase/migrations/20251030003814__initial-schema.sql"
   ```

4. **Replace the placeholder file** with the generated schema dump

5. **Review and clean the exported SQL**:
   - Remove any project-specific data if present
   - Ensure all RLS policies are included
   - Verify triggers and functions are exported

6. **Fix the RLS issue** for transaction DELETE operations (critical security fix)

## Files Created/Modified

- `scripts/export-schema.mjs` - Initial export attempt script
- `scripts/export-schema-via-api.mjs` - Table discovery script
- `supabase/migrations/20251030003814__initial-schema-placeholder.sql` - Placeholder migration with instructions
- `supabase/migrations/SCHEMA_EXPORT_REPORT.md` - This report

## Smoke Test Results

```
✓ creates a transaction via service role and reads it as anon user (155ms)
✗ enforces RLS by blocking anon deletion (123ms) - CRITICAL SECURITY ISSUE
```

## Next Steps

1. **Immediate**: Get database password and complete schema export
2. **Critical**: Fix RLS policies for DELETE operations on transactions table
3. **Verification**: After fixing RLS, ensure all smoke tests pass
4. **Documentation**: Update this report with the final migration details

## Command Reference

```bash
# After getting the database password:
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.nqbacrjjgdjabygqtcah.supabase.co:5432/postgres"

# Export full schema
npx supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --data false --file supabase/migrations/$(date +%Y%m%d%H%M%S)__initial-schema.sql

# Lint the migration
SUPABASE_DB_URL=$SUPABASE_DB_URL npm run db:lint

# Verify smoke tests
npm run test:supabase-smoke
```

## Notes

- The Supabase JS client cannot export database schema DDL (requires direct Postgres access)
- RLS policies, triggers, and functions require `supabase db dump` with database credentials
- The placeholder migration file contains the list of confirmed tables as a reference