# Supabase Schema Export Report
**Date**: 2025-10-30
**Engineer**: Claude → handed off to ChatGPT (backend)

## Summary

- Baseline Supabase schema captured (reconstructed from code paths until direct pg_dump is available)
- Critical RLS vulnerability on `transactions` table identified **and fixed**
- Supabase smoke suite now passes (CRUD + RLS: CREATE, READ, DELETE blocked for anon)

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

5. **Captured canonical schema**:
   - `supabase/migrations/20251030003814__initial-schema.sql`
   - Generated via `pg_dump --schema-only --no-owner --no-privileges` against pooler host
   - Includes tables, views, functions, triggers, indexes, and RLS policies

### ✅ RLS Status

- Vulnerability (anon delete) reproduced by Supabase smoke suite
- Fixed via `supabase/migrations/20251030004200__diagnose-and-fix-rls.sql` (drops/rebuilds SELECT/INSERT/UPDATE/DELETE policies and re-enables RLS)
- Verified with `npm run test:supabase-smoke` (all tests green)

## Migration Files Created

1. **Initial Schema**: `supabase/migrations/20251030003814__initial-schema.sql`
   - Canonical `pg_dump` snapshot (pooler host `aws-0-eu-west-2.pooler.supabase.com`, user `postgres.nqbacrjjgdjabygqtcah`)
   - Serves as baseline for subsequent migrations

2. **RLS Security Fix**: `supabase/migrations/20251030004200__diagnose-and-fix-rls.sql`
   - Drops all existing policies on `transactions`
   - Rebuilds SELECT/INSERT/UPDATE/DELETE policies (blocking anon, allowing owners + service role)
   - Leaves diagnostic queries at the top for auditing—safe to keep as they run `SELECT ...` only

## Required Actions

### Immediate actions

- ✅ (Done) Apply RLS fix (`20251030004200__diagnose-and-fix-rls.sql`) via Supabase SQL editor
- ✅ (Done) `npm run test:supabase-smoke`
- 🔁 Continue monitoring nightly smoke workflow (`.github/workflows/supabase-smoke.yml`)

## Files Created/Modified

- `scripts/export-schema.mjs` / `scripts/export-schema-via-api.mjs` - Helpers retained for troubleshooting
- `supabase/migrations/20251030003814__initial-schema.sql` - Canonical schema dump (replaces placeholder)
- `supabase/migrations/20251030004200__diagnose-and-fix-rls.sql` - RLS rebuild (already applied)
- `supabase/docs/SCHEMA_EXPORT_REPORT.md` - This report (moved out of migrations directory)

## Smoke Test Results (latest)

```
✓ creates a transaction via service role and reads it as anon user
✓ enforces RLS by blocking anon deletion (record remains, no error surfaced)
```

## Next Steps

1. Keep the pooler host/service password safe; future migrations should be scripted via the Supabase CLI or pg_dump using the same parameters.
2. Before major releases, run `pg_dump --schema-only` again and diff against `20251030003814__initial-schema.sql` to confirm migrations are complete.
3. Ensure nightly smoke workflow remains green; add additional Supabase suites as new features rely on the database.

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
