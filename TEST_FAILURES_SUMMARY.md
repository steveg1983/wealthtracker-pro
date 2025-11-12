# Test Suite Failures - Decimal Migration Impact

**Date:** 2025-11-04
**Context:** Post-Decimal migration test verification
**Test Command:** `npm run test:run` (partial - killed after 28+ minutes)

---

## Summary

**Total Identified Failures:** 65 tests across 4 test suites
**Status:** TypeScript passing, targeted tests passing, but full suite reveals issues

---

## ❌ Failed Test Suites

### 1. src/store/slices/recurringTransactionsSlice.test.ts
**Failures:** 2 out of 34 tests
**Category:** Redux Store

#### Failing Tests:
1. `addRecurringTransaction > adds a new recurring transaction with generated id and timestamps`
   - **Error:** `expected { …(16) } to match object { …(14) }`
   - **Cause:** Test expects 14 properties but reducer returns 16
   - **Likely Issue:** Decimal migration added new properties to transaction objects

2. `addRecurringTransaction > adds recurring transaction with optional fields`
   - **Error:** `expected { Object (description, amount, ...) } to match object { Object (description, amount, ...) }`
   - **Cause:** Property mismatch after Decimal changes

**Fix Required:** Update test expectations to match new Decimal-based transaction shape

---

### 2. src/contexts/BudgetContext.test.tsx
**Failures:** 8 out of 34 tests
**Category:** Budget Context Logic

#### Root Cause:
The `getBudgetByCategory` function returns `undefined` for all test cases instead of budget objects.

#### Failing Tests:
1. `getBudgetByCategory > returns active budget for category`
   - Expected: Budget object
   - Got: `undefined`

2. `getBudgetByCategory > ignores inactive budgets`
   - Expected: `'budget-2'`
   - Got: `undefined`

3. `getBudgetByCategory > returns first active budget if multiple exist for category`
   - Expected: `'budget-1'`
   - Got: `undefined`

4. `getBudgetByCategory > handles budget with isActive undefined as active`
   - Expected: Defined budget object
   - Got: `undefined`

5. `complex scenarios > handles multiple budget operations`
   - Expected: `600`
   - Got: `undefined`

6. `complex scenarios > handles budget tracking workflow`
   - Expected: `50`
   - Got: `undefined`

7. `complex scenarios > handles budget period conversions`
   - Expected: `200`
   - Got: `0`

8. `complex scenarios > handles budget categories with special characters`
   - Expected: Defined value
   - Got: `undefined`

**Fix Required:** Investigate `getBudgetByCategory` implementation - likely broken by Decimal migration affecting how budgets are stored/retrieved

---

### 3. src/components/ReconciliationModal.test.tsx
**Failures:** ALL 51 tests (100% failure rate)
**Category:** Component Tests

#### Root Cause:
Test setup missing `PreferencesProvider` wrapper.

#### Error (all tests):
```
Error: usePreferences must be used within PreferencesProvider
  at usePreferences (src/contexts/PreferencesContext.tsx:440:11)
  at useCurrencyDecimal (src/hooks/useCurrencyDecimal.ts:20:41)
  at ReconciliationModal (src/components/ReconciliationModal.tsx:29:30)
```

#### Analysis:
- `ReconciliationModal` uses `useCurrencyDecimal` hook
- `useCurrencyDecimal` calls `usePreferences`
- Tests don't wrap component in `PreferencesProvider`

**Fix Required:** Add `PreferencesProvider` to test setup/wrapper

---

### 4. src/components/GoalModal.test.tsx
**Failures:** 4 out of 77 tests
**Category:** Component Tests

#### Failing Test:
`linked accounts section > displays all available accounts as checkboxes`

#### Error:
```
Unable to find an element with the text: Checking Account (checking).
This could be because the text is broken up by multiple elements.
```

#### Analysis:
Looking at the rendered HTML, the text IS present but split across multiple `<span>` elements:
```html
<span class="text-sm text-gray-700 dark:text-gray-300">
  Natwest Current Account
  (
  current
  )
</span>
```

The test looks for exact string `"Checking Account (checking)"` but rendering produces separate text nodes.

**Fix Required:** Use flexible text matcher or regex in test assertions

---

## ✅ Passing Test Suites

The following suites passed completely:
- `src/services/themeSchedulingService.test.ts` (40 tests, 2 skipped)
- `src/contexts/TransactionContext.test.tsx` (41 tests)
- `src/services/financialPlanningService.test.ts` (39 tests)
- `src/services/offlineService.test.ts` (32 tests)
- `src/contexts/NotificationContext.test.tsx` (33 tests, 1 skipped)
- `src/components/ValidationTransactionModal.test.tsx` (53 tests)
- `src/components/widgets/CashFlowWidget.test.tsx` (27 tests)
- `src/components/OFXImportModal.test.tsx` (35 tests)
- `src/components/QIFImportModal.test.tsx` (38 tests)
- `src/services/cashFlowForecastService.test.ts` (22 tests)
- `src/services/searchService.test.ts` (64 tests)
- `src/services/stockPriceService.test.ts` (36 tests)
- `src/services/smartCategorizationService.test.ts` (23 tests)
- `src/components/ImportDataModal.test.tsx` (30 tests)
- `src/components/DashboardModal.test.tsx` (36 tests)
- `src/components/widgets/UpcomingBillsWidget.test.tsx` (23 tests)
- `src/components/common/AccessibleTable.test.tsx` (31 tests)

**Note:** Full suite was killed after 28+ minutes while still running. Additional failures may exist in untested files.

---

## Priority Fixes

### HIGH PRIORITY:
1. **ReconciliationModal.test.tsx** - 51 tests blocked by missing provider
   - Impact: HIGH - entire modal untested
   - Fix: Add `PreferencesProvider` wrapper in test setup
   - Effort: 5 minutes

2. **BudgetContext.test.tsx** - 8 tests failing, core function broken
   - Impact: HIGH - budget lookup functionality broken
   - Fix: Debug `getBudgetByCategory` function
   - Effort: 30-60 minutes

### MEDIUM PRIORITY:
3. **recurringTransactionsSlice.test.ts** - 2 tests failing
   - Impact: MEDIUM - Redux state shape mismatch
   - Fix: Update test expectations for new Decimal properties
   - Effort: 15 minutes

4. **GoalModal.test.tsx** - 4 tests failing
   - Impact: LOW - Test matcher issue, not code bug
   - Fix: Use flexible text matcher
   - Effort: 10 minutes

---

## Running Tests Locally

### Recommended Commands:

```bash
# Full suite (bypasses npm timeout issues)
npm run test:direct

# Batched with detailed reporting
npm run test:batched

# Specific failing suites only
npx vitest run src/contexts/BudgetContext.test.tsx
npx vitest run src/components/ReconciliationModal.test.tsx
npx vitest run src/store/slices/recurringTransactionsSlice.test.ts
npx vitest run src/components/GoalModal.test.tsx
```

### For Fastest Verification:
```bash
# Run just the failing tests
npx vitest run src/contexts/BudgetContext.test.tsx src/components/ReconciliationModal.test.tsx src/store/slices/recurringTransactionsSlice.test.ts src/components/GoalModal.test.tsx
```

---

## Next Steps

1. Fix `ReconciliationModal.test.tsx` (easiest - test setup)
2. Debug `BudgetContext` `getBudgetByCategory` function (highest impact)
3. Update `recurringTransactionsSlice` test expectations
4. Fix `GoalModal` text matcher assertions

Once fixed, verify with:
```bash
npm run test:direct
```

---

## Technical Details

### Scripts Created:
- **scripts/run-tests-direct.mjs** - Direct Vitest runner, no timeout
- **scripts/run-all-tests.mjs** - Batched runner with JSON reporting
- **scripts/TEST_RUNNER_README.md** - This file

### Package.json Changes:
Added two new npm scripts:
- `test:direct` → `node scripts/run-tests-direct.mjs`
- `test:batched` → `node scripts/run-all-tests.mjs`

### Why This Works:
- Bypasses npm script wrapper overhead
- Spawns Vitest as child process directly
- No timeout limits imposed
- Gives full control over execution

---

Last updated: 2025-11-04 by Claude Code
