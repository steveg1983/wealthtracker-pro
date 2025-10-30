# Development Workflow Enhancements

## Husky Pre-commit Guard

- `husky` is configured at the repository root. Running `npm install` (or `npm ci`) triggers the `prepare` script and installs hooks automatically.
- The `pre-commit` hook now runs from the repo root and executes:
  1. `npm run lint -- --no-cache`
  2. `npm run test:smoke`
- Both commands execute directly against the flat app—no workspace forwarding required.

## Manual Execution

If you want to re-run the hook logic outside of Git:

```sh
npm run lint -- --no-cache
npm run test:smoke
```

## Supabase "REAL" smoke run

Real integration suites are opt-in. To exercise them locally or in CI you must:

1. Provide Supabase credentials: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and a privileged `VITE_SUPABASE_SERVICE_ROLE_KEY`. Store them in `.env.test.local` (preferred) so the smoke helper can load them automatically. `.env.local` is used only for interactive dev.
2. Explicitly opt-in via `RUN_SUPABASE_REAL_TESTS=true`.
3. Run the dedicated command:

```sh
# Using environment variables directly
RUN_SUPABASE_REAL_TESTS=true \
VITE_SUPABASE_URL=https://nqbacrjjgdjabygqtcah.supabase.co \
VITE_SUPABASE_ANON_KEY=... \
VITE_SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/run-supabase-smoke.mjs

# Or rely on .env.test.local via npm script
npm run test:supabase-smoke
```

The helper loads `.env.test.local` / `.env.test` / `.env.local`, validates the required keys, and runs the Supabase Vitest battery under the Node environment. If no smoke suites are present it logs a warning and exits gracefully.

**Status**: ✅ **Operational** (2025-10-29) – `src/test/supabase/supabase-smoke.test.ts` seeds a profile + account, writes a transaction via the service role, verifies it via the anon client, asserts anon deletes are blocked by RLS, and cleans up. A dedicated workflow (`.github/workflows/supabase-smoke.yml`) runs nightly and on demand when the following repository secrets are present:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`

The workflow is guarded so it silently skips when any secret is missing. Coordinate with DevOps before enabling it in production to manage costs and rate limits.

## Supabase migrations

- Migration files live under `supabase/migrations/` and follow the naming convention `YYYYMMDDHHMM__slug.sql`.
- Use the Supabase CLI to create/apply migrations:

  ```sh
  # create a new migration skeleton
  npm run db:migration:new add_accounts_index

  # apply migrations to the target database (requires SUPABASE_DB_URL)
  SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres npm run db:migrate

  # lint migrations before committing (uses `supabase db lint --linked --fail-on error`)
  SUPABASE_DB_URL=... npm run db:lint

  # diff dashboard changes into a migration file
  SUPABASE_DB_URL=... npm run db:diff

  # export complete schema (initial baseline capture)
  npx supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --data false --file supabase/migrations/$(date +%Y%m%d%H%M%S)__initial-schema.sql
  ```

- Keep the DSN scoped to staging/test databases—never run migrations against production without approval + backup.
- After applying migrations, always run `npm run test:supabase-smoke` to confirm CRUD/RLS behaviours.
- For full end-to-end instructions see `supabase/README.md`.
- **Initial schema export**: See `supabase/migrations/SCHEMA_EXPORT_REPORT.md` for capturing baseline schema with RLS policies.

**Build Fix**: `scripts/build-web.mjs` now shells out to `npx vite build`, so Vercel can build the flat layout without workspace shims.

## Temporarily Bypassing the Hook

Only skip the hook for critical hotfixes. Preferred options:

- Disable Husky for a single command:

  ```sh
  HUSKY=0 git commit
  ```

- Or use Git's native flag:

  ```sh
  git commit --no-verify
  ```

Follow up every bypass with the full lint + smoke suite before merging.

## CI gate coverage

- `ci.yml` quality job now runs `npm run typecheck:strict` before the baseline `tsc --noEmit`.
- Unit test job executes the focused LoadingScreen suite (`npm run test -- --run src/components/LoadingScreen.test.tsx`) alongside the broader mocks.
- Build stage runs `npm run bundle:check` immediately after producing `dist/` to surface bundle regressions.
- Optional Supabase job triggers `npm run test:supabase-smoke` under `continue-on-error` until the RLS policy fixes ship.

### Coverage thresholds

Unit coverage is now treated as a gate. After `npm run test:coverage`, CI executes:

```sh
node scripts/verify-coverage-threshold.mjs coverage/coverage-final.json --statements=75 --branches=55
```

If either percentage drops below the threshold the workflow fails. Run the same command locally whenever you touch shared services to confirm you're still above **75 % statements / 55 % branches** before pushing.
