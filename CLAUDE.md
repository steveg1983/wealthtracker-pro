# Engineering Bible – WealthTracker Web

**Owner**: Frontend/Platform (ChatGPT)  
**Branch**: `claude-lint-cleanup`  
**Updated**: 2025‑11‑02

---

## 1. Current State

| Check | Command | Status | Notes |
| --- | --- | --- | --- |
| Lint | `npm run lint` | ✅ | Zero warnings/errors |
| Strict types | `npm run typecheck:strict` | ✅ | TS 5.8 strict |
| Smoke tests | `npm run test:smoke` | ✅ | JSdom + Vitest |
| Realtime suite | `npm run test:realtime` | ✅ | Driven by `scripts/realtime-tests.json` |
| Coverage | `npm run test:coverage` | ✅ | Enforced floor ≥75 % statements / ≥80 % branches |
| Threshold | `node scripts/verify-coverage-threshold.mjs …` | ✅ | ≥75 % statements / ≥80 % branches (raised 2026-08-12 from 63/55; measured 77.13/82.48) |
| Supabase smoke | `npm run test:supabase-smoke` | ✅ | Logs saved to `logs/supabase-smoke/` |
| Build parity | `npm run build` | ✅ | Mirrors Vercel’s `vite build` via `scripts/build-web.mjs` |
| Desktop bundle | `npm run desktop:verify` | ✅ | Builds `src/desktop` → `apps/desktop/dist`, then PHASE3-PLAN §5’s two bundle greps, then the size ratchet. REFUSES rather than skips when there is no build |
| Desktop size | `npm run bundle:check:desktop` | ✅ | 259.3 KiB raw / 86.7 KiB gz over 3 files; budgets 285 / 96 KiB. **Raw** is the gate — nothing is downloaded, the bytes are embedded in the binary. Binary size recorded, never gated |
| Desktop shell | `npm run desktop:check` | ✅ | clippy `-D warnings` + the shell crate's own 12 tests (`apps/desktop/src-tauri`) |
| Desktop build | `npm run desktop:build` | ✅ | `vite` → `apps/desktop/dist`, then `cargo build --release` → 16.1 MB. The renderer must be built first: `generate_context!` embeds it |

### The local edition's lanes

Node **22+** (they open ledger files with `node:sqlite`), and a release bridge
binary: `cargo build --manifest-path crates/Cargo.toml --features cli --release`.
Every one of them refuses to run without what it needs rather than skipping.

| Check | Command | Status | Notes |
| --- | --- | --- | --- |
| Ledger core | `cargo test --manifest-path crates/Cargo.toml --all-features` | ✅ | 468 tests, 24 suites. The money lints (`unwrap_used`, `panic`, `float_arithmetic`, …) are `deny` in `Cargo.toml`; clippy is what enforces them |
| Contract | `npm run test:local-contract` | ✅ | 127 checks, 5 files — the real crate against real SQLite files through `DataPort` |
| Admission | `npm run test:local-admission` | ✅ | 109 specs: the shipping TypeScript against the Rust port of it |
| Constraint parity | `npm run test:local-sqlite` | ✅ | 67 specs, 16 declared divergences. **Needs `bash scripts/local-db/up.sh`** |
| Verb parity | `npm run test:local-verbs` | ✅ | 474 specs, 26 declared divergences, 24 single-engine. Same cluster |

**Where they run.** The desktop renderer trio, the Rust core suites, contract
and admission are on **every PR**. The two differential lanes and
`desktop:check`/`desktop:build` are **nightly** — the first pair needs a
PostgreSQL cluster with the migration history applied, the second needs
webkit2gtk and 262 CPU-seconds to link 454 crates. The split is by cost, never
by importance; `docs/edition-gating.md` argues it out, and
`src/desktop/__tests__/desktopIsGated.test.ts` fails if a step is dropped from
either workflow.

⚠️ **A type error in `src/desktop` fails none of the desktop commands.** Vite hands
TypeScript to esbuild, which strips types without reading them — measured,
`desktop:ui` exits 0 on a renderer that does not typecheck. Only
`typecheck:strict` catches it, through the root `tsconfig.json`'s reference to
`tsconfig.desktop.json`.

Latest Vercel preview: `wealthtracker-l514dsq11` (2025‑10‑29 21:33 UTC). Build chunk warnings (Plotly/XLSX) tracked in `docs/bundle-optimization-plan.md`.

---

## 2. Guardrails & Tooling

### Quality Gates
1. **Lint** → **Strict TS** → **Smoke** → **Realtime Suite** → **Coverage** → **Coverage Threshold** → **Bundle Check** → **Build** (see `.github/workflows/handoff-snapshot.yml`, job `quality-gates`).
   Two more jobs run beside it on every PR: **`desktop-renderer`** (build, cloud greps, size ratchet) and **`local-core`** (clippy, 468 Rust tests, contract, admission). The environment-heavy lanes are nightly in `.github/workflows/local-edition-nightly.yml`.
2. `scripts/realtime-tests.json` enumerates every deterministic/timer-heavy service test. `npm run test:realtime` calls `scripts/run-realtime-suite.mjs` so adding coverage is a manifest edit.
3. Coverage enforcement runs through `scripts/verify-coverage-threshold.mjs` (loads `coverage/coverage-final.json`, merges shards automatically).

### Supabase
- `scripts/run-supabase-smoke.mjs` discovers `supabase` tests, loads `.env.test.local`, and writes timestamped logs to `logs/supabase-smoke/<ISO>_supabase-smoke.log` plus `latest.log`. Nightly GitHub workflow uploads the log artifact for auditing.
- Schema + migrations live under `supabase/`. Use `npm run db:migration:new`, `db:migrate`, `db:diff`, `db:lint`, `db:reset` with `SUPABASE_DB_URL`.
- CI secrets required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
- ⚠️ **Never prefix a service-role key with `VITE_`.** Vite inlines every `VITE_*` var into the
  public browser bundle at build time; a `VITE_SUPABASE_SERVICE_ROLE_KEY` leaked the master key
  into `dist/` in June 2026. The server/CI name is `SUPABASE_SERVICE_ROLE_KEY` (no prefix) — that
  is the GitHub Actions secret and the only name `api/_lib/supabase.ts` accepts.

### Editions
- Shared UI imports the data layer as **`@data`**, never by path. The specifier is what
  chooses the engine: `services/port/index.ts` (DataService) in the web build,
  `services/local/deviceDataPort.ts` (the open ledger file) in a desktop window.
  `eslint.config.js` enforces it; `docs/edition-gating.md` explains the whole mechanism.
- A desktop-reachable module may not import Supabase, Clerk, Sentry, Stripe, the banking
  service or the web's choosing line. Checked at three altitudes: lint, two import-graph
  walks, and the bundle greps.
- The renderer also has a **size** ratchet, because growth that is perfectly cloud-free
  passes all three of those. 259.3 KiB raw today; the 144-module `components/Layout`
  graph is what it is guarding against.
- `src/desktop/routes.ts` must have an answer for every `path=` in `src/App.tsx`. Adding a
  route to the web router without one fails `desktopRouter.test.tsx`.

### Collaboration Rules
- Keep selectors stable for dashboard/import journeys; log multi-file UI refactors in the latest regression audit doc.
- No schema/service contract changes without Supabase smoke updates or feature flags.
- Husky + CI hooks may not be bypassed. If an emergency hotfix requires it, run the full gate locally immediately afterwards.

---

## 3. Focus Forward

| Area | Owner | Description |
| --- | --- | --- |
| **Design/AXE polish** | Frontend | Accessibility + visual sweep over dashboard/import flows (AXE violations, keyboard focus, copy tweaks). |
| **Bundle follow-up** | Platform | Track large chunk work items documented in `docs/bundle-optimization-plan.md`; align with design polish so lazy-loading work doesn’t regress UX. |
| **Supabase coverage** | BE + Platform | Continue monitoring nightly Supabase smoke logs; add RLS/import edge cases as regressions appear. |

Everything else (lint/type safety/tests/build) is green; once the design/AXE pass lands we’ll revisit this section.

---

## 4. Reference Commands

```bash
# Quality gates
npm run lint
npm run typecheck:strict
npm run test:smoke
npm run test:realtime
npm run test:coverage
node scripts/verify-coverage-threshold.mjs coverage/coverage-final.json --statements=75 --branches=80

# Supabase smoke (requires real creds)
RUN_SUPABASE_REAL_TESTS=true npm run test:supabase-smoke

# Deploy parity
npm run build

# The local edition (Node 22+)
cargo build --manifest-path crates/Cargo.toml --features cli --release
cargo test  --manifest-path crates/Cargo.toml --all-features
npm run test:local-contract
npm run test:local-admission
npm run desktop:verify

# …and the two that need the throwaway Postgres
bash scripts/local-db/up.sh
npm run test:local-sqlite
npm run test:local-verbs
bash scripts/local-db/down.sh
```

---

## 5. Useful Paths

- `scripts/realtime-tests.json` – manifest for deterministic suites.
- `scripts/run-realtime-suite.mjs` – Vitest runner (reads manifest).
- `logs/supabase-smoke/` – timestamped nightly smoke logs.
- `docs/development-workflow.md` – environment setup & guardrails.
- `docs/regression-audit-*.md` – latest dashboard/import regression runs.
- `docs/edition-gating.md` – how one source tree makes two editions, and which gate runs where.
- `scripts/local-db/` – the throwaway Postgres the differential lanes need (`up`/`test`/`down`, `pgbin.sh`).
- `scripts/local-sqlite/README.md` – the three differential lanes and every declared divergence.
- `apps/desktop/README.md` – the shell, what is verified in it and what needs a GUI session.

Update this file whenever guardrails, workflows, or focus areas change.
