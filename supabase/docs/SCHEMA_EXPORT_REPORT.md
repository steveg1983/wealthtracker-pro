# Supabase Schema Export Report
**Date**: 2025-10-30
**Engineer**: Claude → handed off to ChatGPT (backend)

## Summary

- Baseline Supabase schema captured via authoritative `pg_dump --schema-only --no-owner --no-privileges`
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

6. **Aligned subscription helpers with UUID IDs**:
   - Applied `202511010905__uuid-function-params.sql` so helper functions accept `uuid`.
   - Applied `202511010912__subscription-usage-uuid-constraint.sql` to add `subscription_usage.user_id` unique constraint.
   - `npx supabase db lint --linked --fail-on error` now completes with “No schema errors found”.

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

3. **UUID Function Parameters**: `supabase/migrations/202511010905__uuid-function-params.sql`
   - Refactors subscription helper functions to accept `uuid` arguments, eliminating `uuid = text` comparisons flagged by `supabase db lint`.

4. **Subscription Usage Constraint**: `supabase/migrations/202511010912__subscription-usage-uuid-constraint.sql`
   - Drops the legacy `user_id_text` unique constraint, adds `user_id` unique index to keep the usage upsert aligned with UUID keys.

## Required Actions

### Immediate actions

- ✅ (Done) Apply RLS fix (`20251030004200__diagnose-and-fix-rls.sql`) via Supabase SQL editor
- ✅ (Done) `npm run test:supabase-smoke`
- 🔁 Continue monitoring nightly smoke workflow (`.github/workflows/supabase-smoke.yml`)

## Files Created/Modified

- `scripts/export-schema.mjs` / `scripts/export-schema-via-api.mjs` - Helpers retained for troubleshooting
- `supabase/migrations/20251030003814__initial-schema.sql` - Canonical schema dump (replaces placeholder)
- `supabase/migrations/20251030004200__diagnose-and-fix-rls.sql` - RLS rebuild (already applied)
- `supabase/migrations/202511010905__uuid-function-params.sql` - Enforces UUID arguments for subscription helper functions
- `supabase/migrations/202511010912__subscription-usage-uuid-constraint.sql` - Switches subscription usage upsert target to the UUID column
- `supabase/docs/SCHEMA_EXPORT_REPORT.md` - This report (moved out of migrations directory)

## Smoke Test Results (latest)

```
✓ creates a transaction via service role and reads it as anon user
✓ enforces RLS by blocking anon deletion (record remains, no error surfaced)
```

## Next Steps

1. Keep the pooler host/service password safe; future migrations should be scripted via the Supabase CLI or pg_dump using the same parameters.
2. Before major releases, run `pg_dump --schema-only --no-owner --no-privileges` again and diff against `20251030003814__initial-schema.sql` to confirm migrations are complete.
3. Maintain the `SUPABASE_DB_URL` GitHub secret so `.github/workflows/handoff-snapshot.yml` can execute `npx supabase db lint --linked --fail-on error` during quality gates.
4. Ensure nightly smoke workflow remains green; add additional Supabase suites as new features rely on the database.

## Command Reference

```bash
# After getting the database password:
export SUPABASE_DB_URL="postgresql://postgres.nqbacrjjgdjabygqtcah:<password>@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"

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
