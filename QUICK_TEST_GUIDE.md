# Quick Test Guide - For ChatGPT

## TL;DR - Run This Now:

```bash
cd /Users/stevegreen/PROJECT_WEALTHTRACKER
node scripts/run-tests-direct.mjs
```

This bypasses the npm timeout issue completely.

---

## Alternative Commands (if above fails):

```bash
# Even simpler (no script, just Vitest)
npx vitest run

# With batching
npm run test:batched

# Using npm (might timeout in Codex CLI)
npm run test:direct
```

---

## What We Found (28-minute partial run):

**65 test failures across 4 files:**

1. ❌ **ReconciliationModal.test.tsx** - 51 failures
   - Missing `PreferencesProvider` in test setup

2. ❌ **BudgetContext.test.tsx** - 8 failures
   - `getBudgetByCategory()` broken

3. ❌ **recurringTransactionsSlice.test.ts** - 2 failures
   - Decimal migration object shape mismatch

4. ❌ **GoalModal.test.tsx** - 4 failures
   - Text matcher issue

**See TEST_FAILURES_SUMMARY.md for full details and stack traces.**

---

## Files We Created:

- [scripts/run-tests-direct.mjs](scripts/run-tests-direct.mjs) - Simple runner
- [scripts/run-all-tests.mjs](scripts/run-all-tests.mjs) - Batched runner
- [scripts/TEST_RUNNER_README.md](scripts/TEST_RUNNER_README.md) - Full documentation
- [TEST_FAILURES_SUMMARY.md](TEST_FAILURES_SUMMARY.md) - Failure analysis
- [SOLUTION_SUMMARY.md](SOLUTION_SUMMARY.md) - Complete solution overview
- This file - Quick reference

---

## What Changed:

**package.json:**
```diff
+ "test:direct": "node scripts/run-tests-direct.mjs",
+ "test:batched": "node scripts/run-all-tests.mjs",
```

**No config changes needed** - the harness timeout isn't user-configurable.

---

**Last updated:** 2025-11-04
**Created by:** Claude Code assisting ChatGPT
