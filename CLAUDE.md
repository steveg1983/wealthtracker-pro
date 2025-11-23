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
| Coverage | `npm run test:coverage` | ✅ | 77.6 % statements / 57 % branches |
| Threshold | `node scripts/verify-coverage-threshold.mjs …` | ✅ | ≥75 % statements / ≥55 % branches |
| Supabase smoke | `npm run test:supabase-smoke` | ✅ | Logs saved to `logs/supabase-smoke/` |
| Build parity | `npm run build` | ✅ | Mirrors Vercel’s `vite build` via `scripts/build-web.mjs` |

Latest Vercel preview: `wealthtracker-l514dsq11` (2025‑10‑29 21:33 UTC). Build chunk warnings (Plotly/XLSX) tracked in `docs/bundle-optimization-plan.md`.

---

## 2. Guardrails & Tooling

### Quality Gates
1. **Lint** → **Strict TS** → **Smoke** → **Realtime Suite** → **Coverage** → **Coverage Threshold** → **Bundle Check** → **Build** (see `.github/workflows/handoff-snapshot.yml`).
2. `scripts/realtime-tests.json` enumerates every deterministic/timer-heavy service test. `npm run test:realtime` calls `scripts/run-realtime-suite.mjs` so adding coverage is a manifest edit.
3. Coverage enforcement runs through `scripts/verify-coverage-threshold.mjs` (loads `coverage/coverage-final.json`, merges shards automatically).

### Supabase
- `scripts/run-supabase-smoke.mjs` discovers `supabase` tests, loads `.env.test.local`, and writes timestamped logs to `logs/supabase-smoke/<ISO>_supabase-smoke.log` plus `latest.log`. Nightly GitHub workflow uploads the log artifact for auditing.
- Schema + migrations live under `supabase/`. Use `npm run db:migration:new`, `db:migrate`, `db:diff`, `db:lint`, `db:reset` with `SUPABASE_DB_URL`.
- CI secrets required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

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
node scripts/verify-coverage-threshold.mjs coverage/coverage-final.json --statements=75 --branches=55

# Supabase smoke (requires real creds)
RUN_SUPABASE_REAL_TESTS=true npm run test:supabase-smoke

# Deploy parity
npm run build
```

---

## 5. Useful Paths

- `scripts/realtime-tests.json` – manifest for deterministic suites.
- `scripts/run-realtime-suite.mjs` – Vitest runner (reads manifest).
- `logs/supabase-smoke/` – timestamped nightly smoke logs.
- `docs/development-workflow.md` – environment setup & guardrails.
- `docs/regression-audit-*.md` – latest dashboard/import regression runs.

Update this file whenever guardrails, workflows, or focus areas change.
