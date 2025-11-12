# Test Runner Scripts - Bypass npm Timeout Issues

## Problem

The Codex CLI harness and some CI environments abort `npm run` scripts that take too long. The WealthTracker test suite is comprehensive and slow, causing timeouts.

## Solution

We've created alternative test runners that bypass npm scripts entirely and call Vitest directly.

---

## Quick Start

### Option 1: Direct Runner (Recommended for full suite)
```bash
npm run test:direct
```
**What it does:**
- Runs `npx vitest run` directly (no npm script wrapper)
- No timeout limits
- Full verbose output
- Best for comprehensive test runs

### Option 2: Batched Runner (Best for debugging)
```bash
npm run test:batched
```
**What it does:**
- Runs tests in logical batches (services, contexts, components, etc.)
- Reports progress after each batch
- Saves detailed JSON report to `logs/test-runs/`
- Easier to identify which category is failing

### Option 3: Manual Direct Invocation
```bash
npx vitest run --reporter=verbose
```
**What it does:**
- Absolute simplest approach
- No scripts, no npm, just Vitest
- Use this if even `test:direct` has issues

### Option 4: Targeted Realtime Service Tests
```bash
npm run test:realtime
```
**What it does:**
- Runs only the realtime price service suites (`subscribe`, `error`, `events`, `helpers`)
- Deterministic schedulers keep runtime < 1s inside Codex
- Best for quick sanity checks on the realtime backend without the full suite

---

## Detailed Usage

### Full Suite (npm run test:direct)

```bash
cd /Users/stevegreen/PROJECT_WEALTHTRACKER
npm run test:direct
```

**Output:**
- Live test progress with colors
- Final summary with pass/fail counts
- Exit code 0 = all passed, 1 = failures

---

### Batched Suite (npm run test:batched)

```bash
cd /Users/stevegreen/PROJECT_WEALTHTRACKER
npm run test:batched
```

**Batches:**
1. Services (`src/services/**/*.test.ts`)
2. Contexts (`src/contexts/**/*.test.tsx`)
3. Store/Slices (`src/store/**/*.test.ts`)
4. Components (`src/components/**/*.test.tsx`)
5. Integration Tests (`src/test/integration/**/*.test.tsx`)
6. Hooks (`src/hooks/**/*.test.ts`)
7. Utils (`src/utils/**/*.test.ts`)

**Output:**
- Progress for each batch
- Summary showing which batches passed/failed
- JSON report saved to `logs/test-runs/test-run-TIMESTAMP.json`

---

### Individual Test Files

```bash
# Single test file
npx vitest run src/components/GoalModal.test.tsx

# Multiple specific files
npx vitest run src/components/RecurringTransactionModal.test.tsx src/components/AddInvestmentModal.test.tsx

# By pattern
npx vitest run 'src/services/**/*.test.ts'
```

---

## Comparison with npm scripts

| Command | Method | Timeout Risk | Speed | Use Case |
|---------|--------|--------------|-------|----------|
| `npm run test:run` | Via npm | ⚠️ HIGH | Slow | CI/automated |
| `npm run test:direct` | Direct npx | ✅ NONE | Fast | Manual runs |
| `npm run test:batched` | Batched npx | ✅ NONE | Medium | Debugging |
| `npx vitest run` | Raw CLI | ✅ NONE | Fastest | Quick checks |

---

## Troubleshooting

### Tests Still Timing Out?

If `npm run test:direct` still times out in your harness:

```bash
# Skip npm entirely - run the script directly
node scripts/run-tests-direct.mjs
```

### Want to Run Specific Categories?

```bash
# Just services
npx vitest run 'src/services/**/*.test.ts'

# Just components
npx vitest run 'src/components/**/*.test.tsx'

# Just integration
npx vitest run src/test/integration
```

### Need Even More Control?

Edit `scripts/run-all-tests.mjs` and:
1. Comment out batches you don't need
2. Adjust timeout values (default 120s per batch)
3. Change reporter to `--reporter=dot` for minimal output

---

## Expected Runtime

**Full suite (all ~2000+ tests):**
- Direct runner: ~10-15 minutes
- Batched runner: ~12-18 minutes (overhead from batch management)

**Individual batches:**
- Services: ~30s
- Contexts: ~45s
- Components: ~8-10 minutes (largest batch)
- Store: ~20s
- Integration: ~1-2 minutes

---

## Files Modified

1. **scripts/run-tests-direct.mjs** - Simple direct runner
2. **scripts/run-all-tests.mjs** - Batched runner with reporting
3. **package.json** - Added `test:direct` and `test:batched` scripts

---

## For CI/CD

Update your CI workflow to use:
```yaml
- name: Run Tests
  run: npm run test:direct
  timeout-minutes: 20
```

Or for maximum compatibility:
```yaml
- name: Run Tests
  run: npx vitest run --reporter=verbose
  timeout-minutes: 20
```

---

## Recommendations

**For local development:**
- Use `npx vitest` (watch mode) while coding
- Use `npm run test:direct` before committing
- Use `npm run test:batched` when debugging failures

**For Codex CLI harness:**
- Use `npm run test:direct` or `node scripts/run-tests-direct.mjs`

**For CI:**
- Use `npm run test:direct` with explicit timeout-minutes setting

---

Last updated: 2025-11-04
