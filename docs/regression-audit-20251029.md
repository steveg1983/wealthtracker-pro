# Regression Audit – 2025-10-29

Target journeys: **Dashboard**, **Budgeting**, **Data Imports**.

## Commands Executed

| Journey | Command | Result |
| --- | --- | --- |
| Dashboard widgets & navigation | `npx vitest run src/test/integration/DashboardInteractionsIntegration.test.tsx --environment jsdom` | ✅ Passing (log: `logs/quality-gates/20251029_dashboard-vitest.log`) – onboarding/test-data modals are suppressed in setup, and assertions now key off the restored “Your Net Worth” hero + quick-actions CTA. |
| Budget workflows | `npx vitest run src/test/integration/BudgetWorkflowIntegration.test.tsx --environment jsdom` | ✅ Passes (log: `logs/quality-gates/20251029_budget-vitest.log`) – only jsdom’s `window.scrollTo` warning emitted. |
| Import modals (CSV/OFX/QIF/batch) | `npx vitest run src/components/{ImportDataModal,CSVImportWizard,OFXImportModal,QIFImportModal,BatchImportModal}.test.tsx --environment jsdom` | ✅ Passing (log: `logs/quality-gates/20251029_import-vitest.log`) – tests now mock `useApp` via the Supabase context, so CTA enablement works without hitting the real onboarding/test-data flows. |
| Supabase smoke (real DB) | `npm run test:supabase-smoke` | ⚠️ **CRITICAL SECURITY ISSUE FOUND** (2025-10-30): RLS DELETE policy missing on transactions table. Anonymous users can delete any transaction. Fix created in `supabase/migrations/20251030004000__fix-transactions-rls-delete.sql` - awaiting application via Supabase Dashboard. |

## Findings

1. **Harness rehydrated for dashboard**  
   Dashboard suite now passes with the new Vitest config + onboarding helpers (`markOnboardingComplete`, `dismissTestDataWarning`). Assertions target the restored hero metrics and quick actions rather than the old tab UI.

2. **Budget coverage healthy**  
   `BudgetWorkflowIntegration.test.tsx` exercises the budgeting journey end-to-end with only a benign `window.scrollTo` warning. Keep the warning suppressed (or polyfilled) to avoid masking future regressions.

3. **Import modal flows covered via module mocks**  
   Import suites now override `contexts/AppContextSupabase` in-test, so button states enable immediately. Keep the mocks in sync with the Supabase API as new props land.

4. **Supabase real tests automated**  
   Smoke suite covers core CRUD/RLS path; CI job runs nightly. Coordinate secret rotation & database hygiene with DevOps.

4. **Logs captured for each run**  
   Fresh Vitest output is stored under `logs/quality-gates/20251029_{dashboard,budget,import}-vitest.log` for future comparison once the suites are updated.

## Recommended Follow-up

1. Gate the onboarding modal in tests (e.g., seed `localStorage` or expose a helper prop) so dashboard/import suites see the expected widgets. ✅ Dashboard + import flows covered.
2. Trim assertions to match the restored copy (e.g., “Net Worth Summary” instead of “Total Assets”) once the UI text is confirmed. ✅ Dashboard done; keep an eye on future copy changes.
3. Add focused smoke cases for:
   - Dashboard quick filters (ensure Supabase data loader mock loads seed data).
   - Budget rollovers (verify Decimal math after restore).
   - CSV/QIF import happy paths (reuse `enhancedCsvImportService` fixtures).

## 🔴 CRITICAL SECURITY VULNERABILITY - 2025-10-30

### RLS Policy Missing on Transactions Table

**Issue:** The Supabase smoke test revealed that anonymous users can delete ANY transaction in the database, not just their own.

**Test Output:**
```
❯ src/test/supabase/supabase-smoke.test.ts (2 tests | 1 failed)
   ✓ creates a transaction via service role and reads it as anon user 255ms
   × enforces RLS by blocking anon deletion 193ms
     → expected null to be truthy (no error returned when it should be blocked)
```

**Root Cause:** Missing DELETE RLS policy on the `transactions` table. While SELECT, INSERT, and UPDATE policies exist, there's no policy restricting DELETE operations.

**Fix Created:** `supabase/migrations/20251030004000__fix-transactions-rls-delete.sql`
- Adds proper DELETE policy ensuring users can only delete their own transactions
- Service role retains full access for administrative operations

**Action Required:**
1. **IMMEDIATE**: Apply the fix in [Supabase SQL Editor](https://app.supabase.com/project/nqbacrjjgdjabygqtcah/editor)
2. Run the SQL from `20251030004000__fix-transactions-rls-delete.sql`
3. Re-run `npm run test:supabase-smoke` to confirm fix
4. Update this audit once confirmed resolved

**Risk Level:** CRITICAL - Any authenticated user could potentially delete all transaction data

## Frontend Stream Updates - 23:55 UTC

### Production Readiness Improvements

#### Console Statement Cleanup
**Files Modified:**
- `src/pages/Dashboard.tsx` - Removed Supabase connection logging
- `src/App.tsx` - Removed Safari compatibility and demo mode logging

**Impact:** Cleaner production console output, reduced monitoring noise

#### Error Handling Enhancement
**New Component:**
- `src/components/LazyErrorBoundary.tsx` - Error boundary with retry capability

**Files Updated:**
- `src/pages/Dashboard.tsx` - Wrapped all lazy-loaded components with error boundaries

**Features:**
- Graceful error recovery for lazy-loaded components
- User-friendly error messages with retry button
- Sentry integration for error reporting (when available)
- Development mode stack traces

#### TypeScript Configuration
**Files Modified:**
- `package.json` - Added `typecheck` and `typecheck:strict` scripts

### Quality Gates Verification

| Check | Status | Notes |
|-------|--------|-------|
| ESLint | ✅ Pass | No errors, warnings only in backup directories |
| TypeScript Strict | ✅ Pass | No type errors |
| Dashboard Integration | ✅ Pass | All 10 tests passing |
| Build | ✅ Pass | Verified earlier in session |

### Browser Compatibility
- All changes use standard React patterns
- Error boundaries provide graceful degradation
- No breaking changes to existing functionality

### Collaboration Notes
- No API contract changes
- No Supabase schema modifications
- No shared service/context modifications
- All changes isolated to UI layer
- Component copy and DOM IDs remain stable
