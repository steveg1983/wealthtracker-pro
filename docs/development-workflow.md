# Development Workflow Enhancements

## Husky Pre-commit Guard

- `husky` is configured at the repository root. Running `npm install` (or `npm ci`) triggers the `prepare` script and installs hooks automatically.
- The `pre-commit` hook now runs from the repo root and executes:
  1. `npm run lint -- --no-cache`
  2. `npm run test:smoke`
3. `npm run test:realtime` (deterministic guardrail: realtime price/subscribe/error/events, predictive loading, scheduled report, automatic backup, secure storage, theme scheduling, sync/auto sync, smart cache, notification/error handling, Stripe, stock price, logging, offline, mobile, performance/optimization, push notification, merchant logo, security, bank connection, offline data, dividend, anomaly detection, data migration, data intelligence, enhanced CSV import, budget recommendation, financial summary, custom report, encrypted storage, export, document, OCR, transaction API, account service, simple account service, user service, data service, supabase service, subscription, realtime service)
- Both commands execute directly against the flat app—no workspace forwarding required.

## Manual Execution

If you want to re-run the hook logic outside of Git:

```sh
npm run lint -- --no-cache
npm run test:smoke
npm run test:realtime
```

The realtime guard now covers deterministic suites for realtime price (subscribe/error/events/helpers), predictive loading, scheduled report, automatic backup, secure storage, theme scheduling, sync, auto sync, smart cache, notification, error handling, Stripe, stock price, logging, offline, mobile, performance, performance optimization, push notification, merchant logo, security, bank connection, offline data, dividend, anomaly detection, data migration, data intelligence, enhanced CSV import, budget recommendation, financial summary, custom report, encrypted storage, export, document, OCR, transaction API, account service, simple account service, user service, data service, supabase service, subscription, and realtime service flows.

## Environment Doctor (`npm run env:doctor` / `npm run setup`)

- `npm run env:doctor` loads `.env.local`, `.env.development`, and terminal overrides via `vite.loadEnv` and runs `checkEnvironmentVariables()` through the scoped logger.
- It surfaces actionable warnings and errors for:
  - `VITE_CLERK_PUBLISHABLE_KEY` (fatal if missing because Clerk cannot hydrate)
  - Supabase URL/anon key omissions (realtime/import fall back to mocks)
  - Sentry mismatches (DSN missing when `VITE_ENABLE_ERROR_TRACKING="true"`, DSN present but tracking disabled, or dev events suppressed without `VITE_SENTRY_SEND_IN_DEV`)
- The script prints a concise summary in the terminal and duplicates the findings via the `EnvCheck` scoped logger so the browser console and CI logs stay deterministic.
- `npm run setup` is a convenience alias for onboarding—run it immediately after cloning or whenever `.env` files change to confirm Clerk/Sentry/Supabase wiring before `npm run dev`.

## Supabase "REAL" smoke run

Real integration suites are opt-in. To exercise them locally or in CI you must:

1. Provide Supabase credentials: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and a privileged `SUPABASE_SERVICE_ROLE_KEY`. Store them in `.env.test.local` (preferred) so the smoke helper can load them automatically. `.env.local` is used only for interactive dev.

   > ⚠️ The service-role key must **never** carry the `VITE_` prefix. Vite inlines every `VITE_*` var into the public browser bundle, so a `VITE_`-prefixed service-role key ships the master key to every visitor (this happened in June 2026). Server, CI, and test environments all use the unprefixed `SUPABASE_SERVICE_ROLE_KEY`.
2. Explicitly opt-in via `RUN_SUPABASE_REAL_TESTS=true`.
3. Run the dedicated command:

```sh
# Using environment variables directly
RUN_SUPABASE_REAL_TESTS=true \
VITE_SUPABASE_URL=https://nqbacrjjgdjabygqtcah.supabase.co \
VITE_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/run-supabase-smoke.mjs

# Or rely on .env.test.local via npm script
npm run test:supabase-smoke
```

The helper loads `.env.test.local` / `.env.test` / `.env.local`, validates the required keys, and runs the Supabase Vitest battery under the Node environment. If no smoke suites are present it logs a warning and exits gracefully.

### When the credentials are absent

Behaviour depends on where it runs, because the two cases mean different things:

| | Missing credentials |
| --- | --- |
| **CI** (`CI` is set) | **Hard failure, exit 1.** The live-infra safety net must never degrade quietly to green — this job once reported success for months with no service-role key. |
| **Local** | **Skipped, exit 0**, with a prominent warning and `Status: SKIPPED` in the run log. |

Credentials are optional locally on purpose. `.env.test.local` is git-ignored, so it does **not** exist in a fresh clone or in any new `git worktree`; hard-failing there blocked every push from those checkouts, which pushed people towards `--no-verify` or towards copying live keys between directories. Both are worse than skipping a check the nightly workflow runs against real infrastructure anyway.

The skip is never silent: it prints on every push and is recorded in the log, so it cannot masquerade as a pass. To run the suite locally, create `.env.test.local` using the key names in `.env.example`. To reproduce the CI behaviour, set `CI=true`.

Each run writes a timestamped log to `logs/supabase-smoke/<ISO>_supabase-smoke.log` (plus `latest.log`), and the nightly GitHub workflow uploads the artifact so failures can be audited without digging through Actions logs.

**Status**: ✅ **Operational** (2025-10-29) – `src/test/supabase/supabase-smoke.test.ts` seeds a profile + account, writes a transaction via the service role, verifies it via the anon client, asserts anon deletes are blocked by RLS, and cleans up. A dedicated workflow (`.github/workflows/supabase-smoke.yml`) runs nightly and on demand when the following repository secrets are present:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_` prefix — server-side only)

**The workflow does not skip when a secret is missing — it fails, loudly, exit 1.** (This paragraph said the opposite until 2026-08-12, contradicting both the table above it and the workflow itself.) Silent skipping is precisely what went wrong before: the job reported success for months with no service-role key, which is the comment now standing at the top of `supabase-smoke.yml`. A nightly that cannot go red is theatre. The local behaviour in the table above is the deliberate exception, and it is never silent either.

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

## The local edition's lanes

The desktop/local edition has its own commands, its own test-runner config and
its own CI jobs. They are separate from everything above because they share no
infrastructure with the web app: no browser, no Supabase, no Clerk.

| command | what it is | what it needs |
| --- | --- | --- |
| `npm run test:local-contract` | 127 checks in five files, driving the real Rust ledger against real SQLite files through the `DataPort` contract | the release bridge binary |
| `npm run test:local-admission` | 109 specs: the shipping TypeScript admission modules against the Rust port of them | the bridge binary |
| `npm run test:local-sqlite` | 67 constraint specs — does the local schema refuse a write the way the cloud's does? | the bridge **and** a Postgres cluster |
| `npm run test:local-verbs` | 474 verb specs — do the Rust command layer and the live Postgres RPC agree on the answer *and* on the rows left behind? | the bridge **and** a Postgres cluster |
| `npm run desktop:verify` | build the renderer, grep it for the cloud, weigh it against its ratchet | Node only |
| `npm run desktop:check` | clippy (`-D warnings`) and the shell's 12 tests | a Rust toolchain |
| `npm run desktop:build` | the renderer, then a release build of the Tauri shell | a Rust toolchain, plus webkit2gtk on Linux |
| `cargo test --manifest-path crates/Cargo.toml --all-features` | 468 tests, the ledger core itself | a Rust toolchain |

Two prerequisites, both of which the lanes **refuse to run without** rather than
skipping to green:

```sh
# the bridge binary (release: these lanes are dominated by process spawns)
cargo build --manifest-path crates/Cargo.toml --features cli --release

# the throwaway Postgres, for the two differential lanes only
bash scripts/local-db/up.sh     # …/down.sh to remove it
```

**Node 22 or newer.** The SQLite side of every one of these is `node:sqlite`,
the runtime's own binding, which does not exist before 22.5. The web app's own
jobs still run Node 20, deliberately: their version is a build-parity question
with Vercel and has nothing to do with this.

Which of these run on a pull request and which run nightly — and why — is in
`docs/edition-gating.md`. `scripts/local-sqlite/README.md` and
`scripts/local-db/README.md` document the two harnesses.

## CI gate coverage

The workflows are `.github/workflows/handoff-snapshot.yml` (every PR, and push
to `main`), `supabase-smoke.yml` and `local-edition-nightly.yml` (nightly), plus
`dependency-audit.yml`, `gitleaks.yml` and `nightly-backup.yml`. There is no
`ci.yml`; an earlier version of this section described one.

`handoff-snapshot.yml` runs four jobs:

- **`check-snapshots`** — `npm run handoff:update` must leave the tree clean.
- **`quality-gates`** — `typecheck:strict` (`tsc -b`, which is also the only
  thing that typechecks the desktop renderer), lint, smoke, realtime, coverage
  and its threshold, Supabase migration lint, `build:check`, `bundle:check`.
- **`desktop-renderer`** — the renderer built, grepped for the cloud, weighed.
- **`local-core`** — clippy and 468 Rust tests on the ledger core, then the
  contract and admission lanes.

Only one step in the whole file is `continue-on-error`: the Supabase migration
lint, which needs a secret. Nothing else may become one —
`src/desktop/__tests__/desktopIsGated.test.ts` fails if a second appears.

### Coverage thresholds

Unit coverage is a gate. After `npm run test:coverage`, CI executes:

```sh
  node scripts/verify-coverage-threshold.mjs coverage/coverage-final.json --statements=63 --branches=55
  # The script autogenerates coverage/coverage-final.json by merging Vitest shards from coverage/.tmp
```

If either percentage drops below the threshold the workflow fails. The floor is
**63 % statements / 55 % branches**, not the 75 % this document claimed until
2026-08-12. It was recalibrated in June 2026, when deleting the dead Redux store
removed ~6.5K lines of heavily-tested dead code that had been inflating the
global ratio; live-code coverage did not regress. The number here, in
`package.json`'s `verify:full`, in the pre-push hook and in the workflow is one
number, and must stay one number.
