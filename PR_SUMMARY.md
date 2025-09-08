# PR: Budget categoryId migration, guardrails hardening, and weekly budgets

## Summary

- Unifies budget matching on `categoryId` across app/services/tests.
- Adds weekly budget logic; hardens CSP/guardrails; cleans Vite manualChunks.
- Documents DecimalBudget boundary mapping; fixes migration writer to use `category_id`.
- Replaces `xlsx` CDN tarball with npm package; excludes backup files from guardrails/tsconfig/eslint.

## Type of Change

- Bug fix, Security, Build/CI, Docs, Tests

## Risk & Rollout

- Risk: Low. Schema alignment: budgets table should have `category_id` (snake_case), matching our mappers.
- Migration writer: writes `category_id` with fallback from legacy `category`.
- Rollout: Safe to ship immediately. No user-facing schema change; readers remain backward compatible.

## "No‑Notes" Checklist (ship‑ready)

### Correctness & Data
- [x] Acceptance criteria met; weekly budgets supported
- [x] Money uses Decimal utilities unchanged
- [x] Domain ↔ DTO ↔ DB mapping explicit; budget `categoryId` normalized
- [x] Dates/amounts normalized at boundaries

### Security
- [x] CSP unchanged or improved (no unsafe-inline/eval); no inline blocks
- [x] Inputs sanitized where applicable; XSS protections intact
- [x] Logs avoid PII; no secrets committed

### Performance & Build
- [x] Bundle budget scripts intact; removed dead chart chunk rules
- [x] Manual chunks updated accordingly
- [x] Docker builder retains devDeps for Vite build

### Testing
- [x] Unit/Integration updated for `categoryId`
- [x] Tests remain meaningful and stable
- [x] Coverage unaffected (spot tests added for migration)

### Reliability & CI
- [x] Lint passes (config updated to ignore backups)
- [x] Types pass (`npx tsc --noEmit`) excluding backup/test-only warnings
- [x] Guardrails show no errors (see matrix)

### Consistency & DX
- [x] Follows project patterns; docs updated (architecture section)
- [x] No stray console in `src/**`; logger used
- [x] No banned imports (Chart.js/Plotly), no lucide-react
- [x] No TODOs left behind

## Guardrail Coverage Matrix

- CSP (unsafe-inline/eval; inline blocks): Yes
- Banned imports (Chart.js/Plotly): Yes
- TS unsafe patterns (double-casts, explicit unknown): Warning only in tests/boundaries
- Playwright baseURL vs Vite port: Yes
- Docker devDeps in builder: Yes

## Critical Fixes (file:line)

- Weekly period logic: `src/store/thunks/index.ts:274`
- Budget matching to `categoryId` (core):
  - `src/store/thunks/index.ts:92,207,258,344,353`
  - `src/pages/Budget.tsx:107` (lookup and display)
  - `src/utils/calculations/budgetCalculations.ts:22,40,85`
  - `src/services/budgetProgressService.ts:24`
- Migration writer uses `category_id`: `src/services/dataMigrationService.ts`
- Decimal boundary docs: `ARCHITECTURE.md`, `src/types/decimal-types.ts:73`
- Deterministic `xlsx`: `package.json:121`
- Vite manualChunks cleanup: `vite.config.ts:116-121`

## Minimal Diffs (top 3 applied)

1) Weekly budgets
- `src/store/thunks/index.ts:274` add `'weekly'` range (Mon–Sun)

2) Budget DTO↔Domain shims + app-wide alignment
- `src/types/mappers.ts:61` map `categoryId` from DTO/legacy `category`
- replace `budget.category` → `budget.categoryId` in thunks/UI/services

3) Migration writer fix
- `src/services/dataMigrationService.ts` insert `category_id` and fallback name from id

## Tests Added/Updated

- `src/services/__tests__/dataMigrationService.test.ts`: asserts `category_id` is written and name fallback
- Updated tests to `categoryId` in:
  - `src/utils/__tests__/calculations.test.ts`
  - `src/utils/__tests__/financialCalculations.test.ts`
  - `src/test/integration/CriticalWorkflows.test.tsx`
  - `src/test/testUtils.tsx`

## Docs Updated

- `ARCHITECTURE.md`: Decimal calculations boundary and mapping contract
- `src/types/decimal-types.ts`: JSDoc on `DecimalBudget.category`

## Branch Protection (recommended required checks)

- `quality` (Code Quality)
- `test-unit` (Unit & Integration Tests)
- `build` (Build Application)
- Optional: `test-e2e` (E2E Tests)
- Informational: `typecheck-strict` (non-blocking)

## Notes

- Guardrails exclude `*.backup.*` by design to avoid noise; no runtime files rely on backups.
- TS-unsafe warnings remain in test setup and boundary APIs by intent.

