# SINGLE ENGINEERING BIBLE – WealthTracker (Web)

**Owner**: Frontend lead (ChatGPT)  
**Last updated**: 2025-10-29

---

## 1. Current Status

- **Branch**: `decimal-migration-restore`
- **Structure**: Restored to the flat Vite React app (no workspaces). All required config files (`vite.config.ts`, Tailwind/PostCSS configs, tsconfigs) and the entire `src/` tree are present again.
- **Build Pipeline (Vercel)**:
  - Helper script `scripts/build-web.mjs` now selects the correct app directory and runs `npm run build` so preview builds succeed.
  - Latest deployment (`wealthtracker-l514dsq11`) completed 2025-10-29 21:33 UTC; build log stored at `logs/deployments/20251029_2133_wealthtracker-web.log`. Vercel executed `vite build` cleanly, though it emitted PostCSS `from` warnings and highlighted multiple >1 MB chunks (`chunk-tBQuDGzl.js`, `index-a-UlsUyK.js`, `xlsx-Bx0RsK1h.js`).
- **Quality Gates (local, 2025-10-29)**:
  - `npm run lint` → ✅
  - `npm run typecheck:strict` → ✅
  - `npm run test:smoke` → ✅ (34 tests)
  - `npm run test:coverage` → ✅ (`apps/web/logs/quality-gates/20251029_141512_test-coverage.log`, 77.6 % statements / 57 % branches)
  - `node scripts/verify-coverage-threshold.mjs … --statements=75 --branches=55` → ✅
  - Supabase smoke (`npm run test:supabase-smoke`) → ✅ Seeds profile/account, writes a transaction via service role, reads it via anon client, and cleans up. Loads credentials from `.env.test.local`.
- **CI Alignment**: `.github/workflows/handoff-snapshot.yml` `quality-gates` job now runs lint/typecheck/smoke/coverage/threshold/build/bundle checks **and** `npx supabase db lint --db-url "$SUPABASE_DB_URL"` when the GitHub secret `SUPABASE_DB_URL` is configured.
- **Docs**: `docs/development-workflow.md` describes the Supabase credentials, coverage gate, and build flow.

---

## 2. Guardrails & Tooling

### Frontend Collaboration Rules

- All frontend branches must keep `npm run lint`, `npm run typecheck:strict`, and the dashboard/import Vitest suites green (`npx vitest run src/test/integration/DashboardInteractionsIntegration.test.tsx --environment jsdom`, etc.).
- Do not touch Supabase schema or service contracts without a matching smoke update; coordinate with backend branches via feature flags if API shape changes are needed.
- Log every multi-file UI refactor or bundle-impacting change in `docs/regression-audit-20251029.md` (or the latest audit doc) so backend teams know which journeys changed.
- For shared files (context providers, hooks), open a PR draft and @mention the backend owner before merging.
- Run `npm run test:coverage` locally before PRs; coverage may not drop below the enforced thresholds (≥75% statements / ≥55% branches).
- Never bypass Husky/CI hooks; if a hotfix requires it, follow up with full test runs immediately afterward.
- Keep component copy/IDs stable unless the change is part of a planned UX update; dashboard/import regression tests rely on those selectors.

- **Coverage Gate**: CI must run `scripts/verify-coverage-threshold.mjs` (≥75 % statements, ≥55 % branches) after `npm run test:coverage`.
- **Build Script**: Root `package.json` `"build"` delegates to `node scripts/build-web.mjs` to stay compatible with Vercel’s npm.
- **Supabase Real Tests**: Set `RUN_SUPABASE_REAL_TESTS=true` and the three Supabase env vars. The script automatically maps `VITE_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`.
- **Supabase Migrations**: Migrations live under `supabase/migrations/` and are managed via Supabase CLI (see `supabase/README.md`). Use npm scripts (`db:migration:new`, `db:migrate`, `db:diff`, `db:lint`, `db:reset`) with `SUPABASE_DB_URL` scoped to staging/test.
- **Supabase Schema Snapshot**: `supabase/migrations/20251030003814__initial-schema.sql` is the authoritative `pg_dump --schema-only --no-owner --no-privileges` export (user `postgres.nqbacrjjgdjabygqtcah`, host `aws-0-eu-west-2.pooler.supabase.com`). Re-dump and diff before major releases; store the DSN in the `SUPABASE_DB_URL` GitHub secret for CI.
- **Supabase Function Fixes**: `202511010905__uuid-function-params.sql` refactors subscription helper functions to accept `uuid` arguments, and `202511010912__subscription-usage-uuid-constraint.sql` aligns the `subscription_usage` upsert to a `user_id` unique constraint so `supabase db lint` passes cleanly.
- **CI Secrets**: Repository secrets must include `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` (postgres role DSN) so scheduled smoke + lint jobs can execute.
- **Supabase Linting**: `.github/workflows/handoff-snapshot.yml` runs `npx supabase db lint --linked --fail-on error` whenever `SUPABASE_DB_URL` is present, ensuring migration regressions fail CI.
- **Vitest Harness**: `vitest.config.ts` drives all suites (JSX automatic runtime, jsdom, backup folders excluded). `src/test/setup.ts` now mocks Clerk/App/Auth providers and polyfills storage.
- **Remaining Monorepo Artifacts**: Packages under `packages/` remain from the old workspace layout but are not part of the current build. Leave untouched until a deliberate cleanup plan is executed.

---

## 3. Next Steps

1. ~~**CI Alignment** – Confirm GitHub Actions still runs lint, strict typecheck, coverage + threshold check, and smoke tests against the restored flat structure. Update workflow paths if necessary.~~ ✅ Updated `quality-gates` workflow 2025-10-29.
2. ~~**Vercel Monitoring** – Watch next preview deployment to ensure `scripts/build-web.mjs` exits cleanly without timeouts; capture logs and update this file with deployment timestamp.~~ ✅ Logged deployment `wealthtracker-l514dsq11` (2025-10-29 21:33 UTC).
3. ~~**Bundle Optimisation Plan** – Document an action list for the large chunks (Plotly/export bundles showing >1 MB). Start by identifying candidate routes for dynamic imports.~~ ✅ See `docs/bundle-optimization-plan.md`.
4. ~~**Documentation Sweep** – Remove or archive references to the old workspace layout (e.g., README snippets, CI docs) so future work doesn’t re-introduce the broken structure.~~ ✅ `docs/` updated for flat layout.
5. **Regression Audit** – Harness restored and runs logged in `docs/regression-audit-20251029.md`; dashboard + import journeys are now green under Vitest. Keep budgeting/import fixtures in sync with future UI tweaks and re-run the regression triad periodically.

**Next Major Initiative** – Monitor the new Supabase smoke workflow (`.github/workflows/supabase-smoke.yml`) nightly runs; add targeted cases (RLS edge cases, imports) as coverage gaps appear.

---

## 4. Reference Commands

```bash
# Lint / type safety
npm run lint
npm run typecheck:strict

# Tests
npm run test:smoke
npm run test:coverage
node scripts/verify-coverage-threshold.mjs coverage/coverage-final.json --statements=75 --branches=55

# Supabase (requires real credentials)
RUN_SUPABASE_REAL_TESTS=true node scripts/run-supabase-smoke.mjs

# Production build (local parity with Vercel)
npm run build
```

---

## 5. Useful Paths

- Coverage logs: `logs/quality-gates/`
- Supabase smoke script: `scripts/run-supabase-smoke.mjs`
- Build helper: `scripts/build-web.mjs`
- Documentation updates: `docs/development-workflow.md`

Keep this file authoritative—update after every structural change, deployment, or guardrail adjustment.
