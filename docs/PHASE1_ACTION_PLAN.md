# Phase 1: Stabilize Quality Gates – Detailed Action Plan

**Status:** In progress – lint + harness milestones underway
**Estimated Effort:** 100–140 hours (revised post Phase 0)
**Priority:** 🚨 CRITICAL – must complete before Phases 2–5
**Prerequisites:** ✅ Phase 0 hygiene complete with accurate baselines (2025-09-29)

---

## Overview
Phase 0 collapsed the problem space from “catastrophic” to “tractable”: **32 ESLint errors** (not 624) and a measurable test suite (**248 suites – 177 pass / 71 fail**). The remaining work is focused, not exploratory.

**Revised estimate breakdown**
- **Linting:** 8–16 h (only 32 errors; rule breakdown known)
- **Testing:** 52–64 h (auth/store harness fixes + brittle test cleanup)
- **CI/CD:** 40–60 h (automation + smoke suite)

---

## Task 1 – Eliminate the 32 ESLint Errors (8–16 h)

### 1.1 Restricted imports (≈14 errors, 4–6 h) ✅ Complete – 2025-09-30
- Replaced remaining Chart.js/Plotly stubs with Recharts wrappers
- Routed Tabler icon use through the central façade and documented exceptions
- Removed obsolete Plotly typings (`src/types/react-plotly.js.d.ts`)

### 1.2 React Hooks ordering (5 errors, 2–3 h) ✅ Complete – 2025-09-30
- Normalised conditional hooks in `AccountSelector`, `VirtualizedList`, `ProtectedRoute`

### 1.3 Switch-case blocks (6 errors, 1–2 h) ✅ Complete – 2025-09-30
- Wrapped remaining case declarations in `EnhancedDraggableDashboard`

### 1.4 Function typing & CommonJS usage (7 errors, 2–3 h) ✅ Complete – 2025-09-30
- Replaced `Function` types in sync services with typed callbacks
- Converted remaining `require` calls in dashboard performance/export services to ESM

### 1.5 Final sweep (≤4 errors, 1–2 h)
- Ensure no stray console usage outside logger façade
- Verify no lingering regex control characters
- `npm run lint -- --quiet` should exit clean

**Deliverable:** ESLint = **0 errors** (warnings tracked for Phase 3)

---

## Task 2 – Reduce warning noise (optional stretch, 8–12 h)
- Current warnings: 2,135 (mostly `no-explicit-any`, `no-unused-vars`)
- Intermediate target: <500 (final target <50)
- Suggested order:
  1. Convert unused vars to `_var` or remove entirely
  2. Replace `@ts-ignore` with `@ts-expect-error` or proper typing
  3. Log `no-explicit-any` instances for Phase 3 (type hardening)

---

## Task 3 – Repair Testing Infrastructure (52–64 h)

### 3.1 Profile & categorise (4 h)
```bash
npm run test -- --run --reporter=verbose
npm run test -- --run --reporter=json > tmp/vitest-baseline.json
```
- Produce table of failing suites (already captured: Supabase auth, Redux slices, brittle console expectations)

### 3.2 Supabase harness (8–12 h) 🔄 In progress
- ✅ Added lightweight Supabase client mock in `src/__mocks__/@supabase/supabase-js.ts`
- ✅ Auto-mocked in `src/test/setup/vitest-setup.ts` so unit suites no longer hit the network
- ✅ Added `VITEST_SUPABASE_MODE=real` opt-out switch for integration runs
- ☐ Load env-driven configuration for integration suites (PGRST100 still outstanding)
- ☐ Document real vs mocked execution modes for CI and local runs

### 3.3 Redux/store factory (12–16 h) 🔄 In progress
- ✅ Exposed `createAppStore` and `createTestStore` utilities with preloaded state support
- ✅ Updated `test-utils.tsx` to allow custom store injection per test
- ✅ Migrated core Redux slice and integration tests onto the shared factory
- ☐ Migrate existing slice/component tests to the factory helpers
- ☐ Add smoke tests demonstrating usage patterns

### 3.4 Stabilise analytics + parser tests (16–20 h)
- Replace brittle console expectations in `mnyParser`/`mbfParser`
- Provide mockable worker/analytics services instead of placeholder “STACK_TRACE_ERROR” stubs
- Document each failure category with tracking tickets

### 3.5 Define smoke suite + coverage (12 h) 🔄 In progress
- ✅ Added initial smoke script (`npm run test:smoke`) targeting fast unit suites
- ☐ Expand selection to cover critical reducers/components <30 s total
- ☐ Configure Vitest coverage to report financial-service coverage (>80% target)
- ☐ Store outputs in `logs/` for CI consumption

**Deliverables:**
- `npm run test:smoke` <30 s with deterministic result
- Full run <5 min, zero critical failures
- Coverage report generated in CI

---

## Task 4 – Enforce CI/CD Quality Gates (40–60 h)

1. **Husky + lint-staged (8–12 h)**
   - Pre-commit: `npm run typecheck:strict`, `npm run lint -- --max-warnings=0`, `npm run test:smoke`
   - Pre-push: optional `npm run bundle:report`

2. **GitHub Actions pipeline (16–24 h)**
   - Jobs: `typecheck`, `lint`, `test:smoke`, `bundle:report`
   - Upload lint/test artifacts for traceability
   - Fail on any quality gate regression

3. **Bundle regression guard (8–12 h)**
   - Parameterize `scripts/bundle-size-check.js` with thresholds per chunk
   - Fail CI if entry >200 KB gzip or vendor chunk grows >5%

4. **Documentation + dashboarding (8–12 h)**
   - Update CLAUDE.md, recovery-status, and CHANGELOG post Phase 1
   - Publish lint/test summaries in `docs/quality-gates.md`

---

## Exit Criteria for Phase 1
- ESLint: 0 errors, warnings trending <500
- Vitest: <30 s smoke suite, full run <5 min, zero critical Supabase/store failures
- CI: Husky hooks + GitHub Actions blocking merges when gates fail
- Documentation: CLAUDE.md §5 / recovery-status aligned with new baselines

> With Phase 1 complete the project regains enforceable quality gates, enabling Phases 2–5 (financial decimals, type safety, performance, coverage) to proceed confidently.
