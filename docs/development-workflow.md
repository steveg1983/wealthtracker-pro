# Development Workflow Enhancements

## Husky Pre-commit Guard

- `husky` is configured at the repository root. Running `npm install` (or `npm ci`) triggers the `prepare` script and installs hooks automatically.
- The `pre-commit` hook now executes from the workspace root and runs the following quality gates:
  1. `npm run lint -- --no-cache`
  2. `npm run test:smoke`
- Both commands rely on workspace-aware scripts (`package.json` delegates to `apps/web`) so monorepo contributors only need to run the commit from the repo root.

## Manual Execution

If you want to re-run the hook logic outside of Git:

```sh
npm run lint -- --no-cache
npm run test:smoke
```

## Supabase "REAL" smoke run

Real integration suites are opt-in. To exercise them locally or in CI you must:

1. Provide Supabase credentials: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and a privileged `VITE_SUPABASE_SERVICE_ROLE_KEY` (stored in `.env.local`).
2. Explicitly opt-in via `RUN_SUPABASE_REAL_TESTS=true`.
3. Run the dedicated command:

```sh
# Using environment variables directly
RUN_SUPABASE_REAL_TESTS=true \
VITE_SUPABASE_URL=https://nqbacrjjgdjabygqtcah.supabase.co \
VITE_SUPABASE_ANON_KEY=... \
VITE_SUPABASE_SERVICE_ROLE_KEY=... \
node apps/web/scripts/run-supabase-smoke.mjs

# Or if credentials are in .env.local, just set the flag
RUN_SUPABASE_REAL_TESTS=true node apps/web/scripts/run-supabase-smoke.mjs
```

The script validates the environment before invoking Vitest and fails fast if any value is missing. When the flag is not present, the individual `*.real.test.*` suites automatically skip via `describeSupabase`. The real-test harness instantiates a single shared Supabase client per worker—never call `createClient` directly inside tests or helpers, and treat any GoTrue "multiple client" warning as a regression.

**Status**: ✅ **PASSING** (2025-10-29 16:40) - All 9 test suites passing with service-role credentials. Script updated to use `npx vitest` for proper execution. Service role key now stored in `.env.local` for persistent local testing.

**Build Fix**: Package.json now uses `cd apps/web && npm run build` for Vercel compatibility (no workspace support required).

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

Unit coverage is now treated as a gate. After `npm run test:coverage --workspace apps/web`, CI executes:

```sh
node scripts/verify-coverage-threshold.mjs apps/web/coverage/coverage-final.json --statements=75 --branches=55
```

If either percentage drops below the threshold the workflow fails. Run the same command locally whenever you touch shared services to confirm you're still above **75 % statements / 55 % branches** before pushing.
