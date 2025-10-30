# Supabase Database Connection Status
**Last Updated:** 2025-10-30

## Connection Details Provided
- **Project Hostname:** `db.nqbacrjjgdjabygqtcah.supabase.co` (IPv6 only)
- **Pooler Host:** `aws-0-eu-west-2.pooler.supabase.com`
- **Username:** `postgres.nqbacrjjgdjabygqtcah`
- **Password:** `SDzMGtV9FGTfdLun`
- **Ports:** 5432 (session pooler), 6543 (transaction pooler)
- **Database:** `postgres`

## Connection Test Results

### ⚠️ Direct Project Host (IPv6 Only)
```bash
# Hostname resolves to IPv6 only (no IPv4 address)
host db.nqbacrjjgdjabygqtcah.supabase.co
→ IPv6: 2a05:d01c:30c:9d1a:2e6d:94e:3814:4edf

# Connection attempt fails - no route to IPv6 host
PGPASSWORD="SDzMGtV9FGTfdLun" psql -h "2a05:d01c:30c:9d1a:2e6d:94e:3814:4edf" -p 5432 -U postgres
```
**Result:** No route to host when IPv6 connectivity is unavailable

### ✅ Pooler Connection (IPv4 Allow-Listed)
After adding our public IPv4 (`86.161.28.220`) to Supabase → Database → Network Restrictions, the pooler host succeeds:
```bash
PGPASSWORD="SDzMGtV9FGTfdLun" pg_dump \
  -h aws-0-eu-west-2.pooler.supabase.com \
  -p 6543 \
  -U postgres.nqbacrjjgdjabygqtcah \
  -d postgres \
  --schema=public \
  --no-owner --no-privileges --schema-only \
  -f supabase/migrations/20251030003814__initial-schema.sql
```

Same credentials work for `psql` connections and Supabase CLI commands (`npx supabase db lint --linked --fail-on error`, `supabase db push`).

### ✅ API Connection Works
- Supabase REST API via JS client works perfectly
- Can read/write data through the API
- Service role key authentication successful

## Possible Causes

1. **Network Restrictions**
   - Direct database access may be IP-restricted
   - Check Dashboard → Database → Network Restrictions

2. **DNS Resolution**
   - The hostname `db.nqbacrjjgdjabygqtcah.supabase.co` doesn't exist in public DNS
   - May require VPN or private network access
   - Could be using IPv6 only

3. **Connection Method**
   - Project might be configured for API-only access
   - Direct PostgreSQL connections might be disabled for security

## Current Baseline

Using the **canonical pg_dump snapshot** in `supabase/migrations/20251030003814__initial-schema.sql`, generated via the pooler host:
- All tables, indexes, constraints, foreign keys
- Custom types, functions, triggers, and views
- RLS policies (including the 2025-10-30 DELETE fix)

## What to Watch

- Keep the pooler allow list current—new IPs must be added before CLI access works.
- Re-run `pg_dump --schema-only --no-owner --no-privileges` before each release and diff against the existing snapshot.
- Update `SUPABASE_DB_URL` secret everywhere CI needs to lint migrations.

## Next Steps to Try

1. **Check Network Restrictions**
   - Dashboard → Database → Network Restrictions
   - Add your IP if restrictions are enabled

2. **Look for IPv6 Address**
   - Some Supabase projects use IPv6 only
   - Check for alternative connection strings in dashboard

3. **Contact Supabase Support**
   - If direct database access is needed for migrations
   - Ask about enabling direct connections for your project

4. **Alternative Export Methods**
   - Use Supabase CLI with project linked (requires auth token)
   - Export via Supabase dashboard if available
   - Use database backup feature if available

## Maintaining Schema

1. **Author migrations locally** against the canonical snapshot and apply via Dashboard SQL Editor or `supabase db push --db-url "$SUPABASE_DB_URL"`.
2. **Keep `SUPABASE_DB_URL`** (pooler DSN) stored securely for engineers and CI. Rotate alongside Supabase password changes.
3. **Run nightly smoke tests** (`npm run test:supabase-smoke`) to validate CRUD + RLS after each deploy.
4. **Use fallback exports** (SQL dashboard queries, access tokens, IPv6 tunnels) only when pooler access is temporarily unavailable, then reconcile with the canonical snapshot.

## Commands Verified

```bash
# Full schema export via pooler host (transaction pooler port 6543)
PGPASSWORD="SDzMGtV9FGTfdLun" pg_dump \
  -h aws-0-eu-west-2.pooler.supabase.com \
  -p 6543 \
  -U postgres.nqbacrjjgdjabygqtcah \
  -d postgres \
  --schema=public --no-owner --no-privileges --schema-only \
  -f supabase/migrations/20251030003814__initial-schema.sql

# Lint migrations (requires SUPABASE_DB_URL environment variable)
SUPABASE_DB_URL="postgresql://postgres.nqbacrjjgdjabygqtcah:SDzMGtV9FGTfdLun@aws-0-eu-west-2.pooler.supabase.com:6543/postgres" \
  npx supabase db lint --linked --fail-on error
```

## Status Summary

- ✅ **API Access**: Working
- ✅ **Pooler Access**: Working (IPv4 allow-listed)
- ✅ **Canonical Schema Export**: Captured via `pg_dump --schema-only --no-owner --no-privileges`
- ✅ **RLS Security**: Fixed and verified
- ✅ **Smoke Tests**: Passing nightly (`.github/workflows/supabase-smoke.yml`)
- ⚠️ **Direct Project Host (IPv6)**: Still requires IPv6 connectivity or tunnel if needed for diagnostics
