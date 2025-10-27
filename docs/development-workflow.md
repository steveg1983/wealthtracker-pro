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

1. Provide Supabase credentials: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Explicitly opt-in via `RUN_SUPABASE_REAL_TESTS=true`.
3. Run the dedicated command:

```sh
RUN_SUPABASE_REAL_TESTS=true \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_ANON_KEY=... \
npm run test:supabase-smoke --workspace apps/web
```

The script validates the environment before invoking Vitest and fails fast if any value is missing. When the flag is not present, the individual `*.real.test.*` suites automatically skip via `describeSupabase`.

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
