# Supabase Schema & Migration Workflow

> Objective: keep every environment (local → staging → production) in sync, with migrations treated as versioned artifacts.

## Repository layout

```
supabase/
├── README.md             ← this file
├── migrations/           ← chronologically ordered SQL migrations
├── docs/                 ← export reports, connection notes, playbooks
└── seeds/                ← optional seed fixtures (JSON/SQL)
```

* Every structural change **must** be captured as a migration in `supabase/migrations/`.
* File naming convention: `YYYYMMDDHHMM__short-description.sql` (double underscore separates timestamp and slug).
* Keep migrations idempotent—add guards (`IF NOT EXISTS`) where feasible and write explicit rollbacks when possible.

## Tooling

We rely on the [Supabase CLI](https://supabase.com/docs/guides/cli) so nothing proprietary leaks into the repo:

```bash
# Install once per machine
npm install -g supabase

# OR run on demand
npx supabase --version
```

The CLI expects credentials for the database you are targeting. Export the DSN before running the commands below:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@<host>:5432/postgres'
```

This DSN should point at a staging / dedicated migration instance. **Never** run migrations against production without a review + backup plan.

## Creating a migration

```bash
# Scaffold a new migration file
supabase migration new add_accounts_index

# Edit the generated SQL under supabase/migrations/<timestamp>__add_accounts_index.sql
# Include both "up" and "down" statements where practical.
```

For large changes, capture the current diff to sanity check before committing:

```bash
supabase db diff --file supabase/migrations/<timestamp>__verify.sql
```

## Applying migrations locally

```bash
# Apply to your local/staging database
supabase db push --include-roles --include-policies --db-url "$SUPABASE_DB_URL"

# Optional: reset and reapply (clears data!)
supabase db reset --db-url "$SUPABASE_DB_URL"
```

Always run the Supabase smoke suite after applying migrations:

```bash
RUN_SUPABASE_REAL_TESTS=true npm run test:supabase-smoke
```

## Pulling schema changes from Supabase dashboard

When an emergency change is made via the dashboard:

```bash
# Dump the current schema/policies
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --schema public \
  --data false \
  --file supabase/schema-dump.sql

# Convert the dump into a migration and commit it.
```

Never leave schema changes untracked. If you must hotfix via the dashboard, convert it into a migration immediately afterwards.

## CI integration

1. Lint a migration by running `supabase db lint --db-url "$SUPABASE_DB_URL"` (add to CI once CLI is available in the build image).
2. After migrations are applied in CI / staging, execute `npm run test:supabase-smoke` to verify CRUD + RLS.
3. Record every migration in the release notes / change log.

## Rollbacks

If a deploy fails:

```bash
# Identify the offending migration
ls -t supabase/migrations

# Apply the rollback manually (or run the inverse SQL). Always smoke-test after rolling back.
```

Document the rollback procedure in the PR so the on-call engineer knows exactly which statements to execute.

---

**Checklist for migration PRs**

- [ ] Includes SQL migration under `supabase/migrations/` with clear timestamp + slug.
- [ ] References any Supabase dashboard changes (none allowed without matching migration).
- [ ] Local smoke suite (`npm run test:supabase-smoke`) passing against the target DB.
- [ ] Regression audit updated if user-facing behaviour changes.
- [ ] Rollback instructions captured in the PR description.
