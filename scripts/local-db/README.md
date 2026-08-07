# Local database harness

Spins up a throwaway PostgreSQL, applies the whole migration history to it, and
runs SQL tests against the result. Nothing here touches Supabase.

## Why

Until this existed, a migration's first execution was against a real database.
`20260807083000_user_data_restore.sql` was written, applied here, and failed
three times before it was correct — a bad column list, a trigger that re-dated
restored history, and a chunk the test never sent. None of that should be
discovered in production.

## Use

```bash
brew install postgresql@17     # once
bash scripts/local-db/up.sh    # init + start + apply every migration
bash scripts/local-db/test.sh  # run the SQL tests
bash scripts/local-db/down.sh  # stop and delete the cluster
```

## Caveats, so the harness is not mistaken for the real thing

- **Supabase's `auth` schema is stubbed.** `auth.uid()`, `auth.role()` and
  `auth.jwt()` are local stand-ins reading `request.jwt.claims`. Identity in the
  tests is set with `set_config('request.jwt.claims', '{"sub":"..."}', false)`.
- **RLS is created but never exercised** — psql connects as superuser, which
  bypasses it. These tests prove logic, not isolation. Row-level isolation is
  still only provable against a real Supabase (`npm run test:supabase-smoke`).
- **Four migrations do not apply**: two early subscription files and two RLS
  files that depend on Supabase-managed roles. They do not affect the tables
  under test. `up.sh` reports them rather than hiding them.
- Migrations are applied in **three passes** because filename order is not
  dependency order — the baseline dump sorts after some files it contains.
