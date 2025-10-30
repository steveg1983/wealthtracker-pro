# Schema Management Plan - Alternative Approaches
**Created:** 2025-10-30

## Current Approach
Direct exports now succeed by allow-listing our IPv4 (86.161.28.220) and targeting the pooler host `aws-0-eu-west-2.pooler.supabase.com` with user `postgres.nqbacrjjgdjabygqtcah`. This produced the canonical snapshot `supabase/migrations/20251030003814__initial-schema.sql` via `pg_dump --schema-only --no-owner --no-privileges`.

The options below remain as fallback strategies when working from environments without IPv4 or when automation requires alternative paths.

### Latest adjustments

- `202511010905__uuid-function-params.sql` updates subscription helper functions (`get_net_worth`, `get_user_subscription`, `has_feature_access`, `update_usage_counts`) to accept `uuid` arguments, removing cross-type comparisons.
- `202511010912__subscription-usage-uuid-constraint.sql` drops the legacy `user_id_text` unique constraint in `subscription_usage` and replaces it with a `user_id` unique index so upserts target the UUID column.

## Alternative Solutions

### Option 1: Use Supabase Dashboard Export (Recommended)
1. **Go to Supabase Dashboard** → SQL Editor
2. **Run this query to export schema**:
```sql
-- Get complete DDL for all objects
SELECT
    'CREATE TABLE ' || schemaname || '.' || tablename || ' (' ||
    array_to_string(
        array_agg(
            column_name || ' ' || data_type ||
            CASE
                WHEN character_maximum_length IS NOT NULL
                THEN '(' || character_maximum_length || ')'
                ELSE ''
            END ||
            CASE
                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                ELSE ''
            END
        ), ', '
    ) || ');' as ddl
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename;
```
3. **Export the results** and save as a migration file

### Option 2: Use Supabase CLI with Access Token
```bash
# 1. Generate an access token from Supabase Dashboard
# Dashboard → Account → Access Tokens → Generate New Token

# 2. Login with token
npx supabase login --token YOUR_ACCESS_TOKEN

# 3. Link to project
npx supabase link --project-ref nqbacrjjgdjabygqtcah

# 4. Pull remote schema
npx supabase db pull

# This creates a local migration file with the current schema
```

### Option 3: IPv6 Connectivity Solutions
1. **Use a cloud-based environment** with IPv6 support:
   - GitHub Codespaces
   - Gitpod
   - AWS CloudShell
   - Google Cloud Shell

2. **Set up IPv6 tunnel**:
   - Use services like Hurricane Electric's tunnel broker
   - Configure IPv6 on your network

3. **Use a VPN/Proxy** that supports IPv6

### Option 4: Schema Documentation via SQL Queries
Run these in Supabase SQL Editor to document your schema:

```sql
-- 1. Get all tables with columns
SELECT
    t.table_name,
    array_agg(
        json_build_object(
            'column', c.column_name,
            'type', c.data_type,
            'nullable', c.is_nullable,
            'default', c.column_default
        ) ORDER BY c.ordinal_position
    ) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
GROUP BY t.table_name;

-- 2. Get all constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public';

-- 3. Get RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public';

-- 4. Get indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public';
```

### Option 5: Use Canonical Snapshot
The current canonical schema in `20251030003814__initial-schema.sql` is:
- ✅ Full `pg_dump --schema-only --no-owner --no-privileges` output (tables, views, functions, triggers, policies)
- ✅ Matches production security posture (RLS rebuild applied 2025-10-30)
- ✅ Works for application needs and migration authoring

**Lean on this snapshot because:**
- The API and smoke suites exercise the same objects that ship to production
- Re-dumping via the pooler host keeps us aligned with Supabase dashboard changes
- Any delta can be diffed directly against this file prior to releases

## Recommended Approach

### Immediate (Continue Development)
1. **Use the canonical snapshot** (`20251030003814__initial-schema.sql`) as the baseline for new migrations.
2. **Apply new migrations** via Supabase Dashboard SQL Editor or `supabase db push` (ensure the DSN uses the pooler host).
3. **Test changes** with smoke tests (`npm run test:supabase-smoke`).
4. **Document all changes** in migration files and diff against the baseline before releases.

### When Pooler Access Is Unavailable
1. **Fall back** to the alternative options (dashboard export, CLI with access token, IPv6-capable environment) outlined above.
2. **Reconcile** the exported schema with `20251030003814__initial-schema.sql` once connectivity is restored.

## Migration Workflow Without Direct Access

### Creating New Migrations
```bash
# 1. Create migration file locally
echo "-- Description of change" > supabase/migrations/$(date +%Y%m%d%H%M%S)__description.sql

# 2. Write your SQL changes
edit supabase/migrations/[timestamp]__description.sql

# 3. Apply via Dashboard
# Go to SQL Editor → New Query → Paste SQL → Run

# 4. Test
npm run test:supabase-smoke

# 5. Commit
git add supabase/migrations/
git commit -m "Add migration: description"
```

### Tracking Schema Changes
1. **Before changes**: Export table definitions via SQL queries
2. **Make changes**: Via Dashboard SQL Editor
3. **After changes**: Export again and diff
4. **Create migration**: Document the changes
5. **Test**: Run smoke tests

## Current State Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Database Access | ✅ Pooler Host | IPv4 allow-listed (86.161.28.220) → `aws-0-eu-west-2.pooler.supabase.com` |
| API Access | ✅ Working | Via Supabase JS client |
| Schema Baseline | ✅ Canonical | `pg_dump --schema-only --no-owner --no-privileges` snapshot (20251030003814) |
| RLS Security | ✅ Fixed | Verified via smoke tests (anon delete blocked) |
| Migrations | ✅ Can Apply | Via `supabase db push` (pooler DSN) or Dashboard SQL Editor |
| Direct pg_dump | ✅ Working | Use pooler host with service password |

## Next Steps

1. **Keep `SUPABASE_DB_URL` secret** in sync across environments (quality-gates workflow depends on it for `npx supabase db lint --linked --fail-on error`).
2. **Re-run `pg_dump --schema-only --no-owner --no-privileges`** against the pooler host before each release train and diff with `20251030003814__initial-schema.sql`.
3. **Document new changes** as migrations and ensure smoke tests cover new tables/policies.
4. **Fallback to alternative exports** only when pooler access is temporarily unavailable, then reconcile with the canonical snapshot.

The application is fully functional, Supabase access is aligned across CLI and dashboard, and the canonical snapshot keeps migrations auditable.
