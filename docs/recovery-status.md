# WealthTracker Recovery Status

**Last Updated (UTC):** 2025-09-29 23:05
**Current Phase:** Phase 0 – Repository hygiene complete, accurate baselines captured

---

## Phase 0 Summary
- Removed legacy `src.backup.*` folders (retained 3 most recent snapshots per policy)
- Centralised ignore rules in `eslint.config.js` / `vitest.config.ts` and removed the obsolete `.eslintignore`
- Regenerated lint and test baselines against the live code only
- Captured metrics for CLAUDE.md, Phase 1 planning, and roadmap updates

**Impact:**
- ESLint problems dropped from 24,808 → **2,167** (errors 624 → **32**, warnings 24,184 → **2,135**)
- Vitest now executes 248 suites in ~7 minutes instead of timing out after 15+ minutes
- Failure signals are real (Supabase auth, Redux store harness, brittle console expectations) instead of duplicated backups

Artifacts removed: `src.backup.*` (older than 3 snapshots), `.eslintignore`
Artifacts added/updated: `eslint.config.js` ignores, `vitest.config.ts` excludes, refreshed baselines in `logs/`

---

## Clean Baseline Metrics (2025-09-29 23:05 UTC)

| Area | Metric | Current | Target |
|------|--------|---------|--------|
| TypeScript | Strict errors | **0** | 0 |
| ESLint | Errors / warnings | **32 / 2,135** | 0 / <50 |
| Testing | Suites (pass/fail) | **248 total – 177 pass / 71 fail** | <30s smoke suite, 0 critical failing |
| Testing | Failed assertions | **150** | 0 critical |
| Testing | Runtime | **~7 minutes** | <30 seconds (smoke), <5 minutes (full) |
| Type Safety | `as any` count | **245 (116 files)** | 0 |
| Financial Safety | `parseFloat` / `toFixed` usage | **162 / 358 hits** | 0 |
| Bundle | Initial payload (gzip) | **≈580 KB** (`index` 132 KB + `vendor-shared` 201 KB + route vendors) | <200 KB |

**Dominant ESLint error categories (32 total):**
- `no-restricted-imports` (Chart.js legacy imports): 14
- `react-hooks/rules-of-hooks`: 5
- `no-case-declarations`: 6
- `@typescript-eslint/no-unsafe-function-type`: 5
- `@typescript-eslint/no-require-imports`: 2

**Dominant Vitest failure signatures (71 failing suites):**
- `AssertionError: expected { code: 'PGRST100' … } to be null` → missing Supabase auth credentials (41 occurrences)
- `TypeError: Cannot read properties of undefined (reading 'reducer')` → Redux slice tests without a store harness (32 occurrences)
- `STACK_TRACE_ERROR` stubs in analytics services (33 occurrences)
- Supabase schema differences (`recurring_template_id`) (7 occurrences)
- Console expectation tests in mny/mbf parsers (multiple occurrences)

---

## Phase 1 Preparation (Next Steps)

1. **Lint cleanup (8–16h)**
   - Replace Chart.js imports with Recharts or lazy wrappers
   - Fix conditional hook usage in `AccountSelector`, etc.
   - Wrap switch cases in blocks
   - Replace CommonJS `require` usage
   - Address unsafe function types

2. **Test harness rehab (60–80h)**
   - Centralise Supabase test configuration (resolve `PGRST100`)
   - Provide shared Redux store utilities for slice tests
   - Rewrite brittle console assertion tests (mny/mbf parsers)
   - Trim analytics “STACK_TRACE_ERROR” stubs or provide real workers
   - Establish <30s smoke run (subset) + documented command

3. **CI / quality gates (40–60h)**
   - Husky + lint-staged (typecheck, lint, vitest smoke)
   - GitHub Actions pipeline (`typecheck:strict`, `lint`, `test:smoke`, `bundle:report`)
   - Publish baseline artifacts (lint/test summaries) as build outputs

4. **Documentation updates**
   - Sync CLAUDE.md section 5, Phase 1 plan, and roadmap checkpoints
   - Keep `docs/PHASE1_ACTION_PLAN.md` aligned with the new breakdown

---

## Outstanding Enterprise Blockers
1. ESLint errors (32) + >2,000 warnings (driven by `no-explicit-any` / `no-unused-vars`)
2. Supabase authentication + store harness gaps causing Vitest failures
3. `parseFloat` / `toFixed` usage across 158+ files
4. 245 `as any` occurrences
5. Initial bundle still ≈580 KB gzip (target <200 KB)

---

_Next update due after Phase 1 quality-gate remediation or when metrics shift by ≥10%_
