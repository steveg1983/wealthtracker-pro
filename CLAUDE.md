# SINGLE ENGINEERING BIBLE – WealthTracker

Owner: Project Engineering Manager
Last updated: 2025-09-29 21:30 UTC
Status: 🔴 **AUDIT COMPLETE + PHASE 0 BASELINE** – Senior engineer audit still holds: D+ (30/100), **NOT ENTERPRISE READY**. After repository hygiene the live tree now reports **ESLint 2,167 problems (32 errors / 2,135 warnings)**, tests run in ~7m (248 suites | 71 failing), but financial safety (158 float files), type bypasses (245 `as any`), and bundle bloat (~580 KB gzip) remain critical. Strict TypeScript: 0 errors ✅. Actual completion: **25-30% toward world-class** (audit-verified). Remediation roadmap: 524-726 hours to enterprise ready.
Authoritative scope: Vision, rules, procedures, audit findings, recovery status, and world-class roadmap.

---

## 1. Mission & Non-Negotiable Standards
- Build the #1 professional personal finance platform with "just works" reliability.
- Subscription SaaS, multi-tenant, secure by default, WCAG 2.1 AA accessible.
- Financial software tolerates **zero** data loss, precision errors, or guesswork.
- **Apple/Google/Microsoft code quality** is the only acceptable standard.
- This document is the **single source of truth**. If it conflicts with other files, this one wins.

---

## 2. Core Principles
1. **Professional Excellence** – Verify every assumption; "good enough" is failure.
2. **Read First, Code Second** – Understand implementations before touching them.
3. **Slower Is Faster** – Diagnose before acting; revert if you feel rushed.
4. **Functional before Cosmetic** – Features must actually work end-to-end.
5. **Financial Integrity** – No floating-point money math; use Decimal.js or precise value objects.
6. **No Half Measures** – If you start a feature, you finish it: UI, services, database, tests, docs.
7. **Testing Reality** – Mocks are last resort; connect to real infrastructure whenever feasible.
8. **Verification Discipline** – Every change runs the full gate (`npm run build:check`, lint, tests) before commit.
9. **Documentation of Why** – Leave breadcrumbs for the next engineer; explain reasoning, not syntax.
10. **Absolute Type Safety** – ZERO `as any` anywhere, ever. No exceptions, no approvals, no compromises.

---

## 3. Operating Procedures & Guardrails
### 3.1 Backup Doctrine
```bash
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)_BEFORE_WORK
# After meaningful milestones (~10 files or major fix)
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)_CHECKPOINT
```
Rollback immediately if verification fails.

### 3.2 Verification Rhythm
```bash
BEFORE=$(npx tsc -p tsconfig.strict.json --noEmit 2>&1 | rg -c "error TS" || echo "fail")
# make one focused change
AFTER=$(npx tsc -p tsconfig.strict.json --noEmit 2>&1 | rg -c "error TS")
```
- Error count must trend down; if it rises, revert.
- Big-picture checks after each session: `npm run build`, `npm run lint`, `npm test --run`, `npm run bundle:report`.

### 3.3 One-File Law
- Change **one logical unit** at a time. No mass find-replace. No reckless scripts.
- Understand ripple effects before modifying shared hooks, services, or contexts.

### 3.4 Documentation Imperative
Log every change (file, line, reason, verification result). Update this bible if procedures or priorities shift.

### 3.5 No-Cowboy Clause (Instant Stop)
- Mass edits without review.
- Silencing errors with `as any` or TODO placeholders.
- Deleting code to "make things compile."
Violations require rollback, root-cause doc, and prevention measures.

### 3.6 Absolute Type Safety Rule (NON-NEGOTIABLE)
**THE ULTIMATE RULE: ZERO "AS ANY" TOLERANCE**

- **ZERO** `as any` in the codebase - not one, not ever
- **ZERO** exceptions - senior engineer approval DOES NOT override this rule
- **ZERO** "temporary" usage - if you can't type it properly, don't write it
- **ZERO** tolerance - `as any` in a PR = automatic rejection, no discussion

**Why This Exists:**
- `as any` completely destroys TypeScript's type safety
- Hides runtime errors that crash in production
- Makes refactoring dangerous and unpredictable
- World-class codebases at Apple/Google/Microsoft ban this completely

**What To Do Instead:**
1. **Create proper type definitions** - invest time in correct types
2. **Use type guards** - `if (typeof x === 'string')` instead of `as any`
3. **Use unknown + narrowing** - but NEVER `as unknown as T` (also banned)
4. **Ask for help** - if stuck on types, ask before bypassing
5. **Refactor the code** - if it can't be typed, redesign it

**Current Reality:** 245 `as any` violations across 116 files = enterprise blocker

### 3.7 Documentation Maintenance & Backup Policy

**CLAUDE.md Update Frequency:**
- Update metrics **immediately** after significant changes (lint fixes, bundle changes, test improvements)
- Update status section **weekly** during active development
- Update roadmap **monthly** or when priorities shift
- Trigger: Any time reality diverges from documentation by >10%

**Backup Management:**
- Keep **maximum 3 most recent** CLAUDE.md backups
- Create backup before major restructuring: `cp CLAUDE.md CLAUDE.md.backup.$(date +%Y%m%d_%H%M%S)`
- Delete oldest backup when creating 4th backup
- Automated cleanup script: `scripts/cleanup-backups.sh`

**Source Code Backup Policy:**
- Keep **maximum 3 most recent** `src.backup.*` directories
- Create backup before risky changes only (not routine work)
- Delete oldest backup when exceeding 3 copies
- **CRITICAL**: Exclude all `src.backup.*` from linting and testing tools
- Automated cleanup: `scripts/cleanup-backups.sh`

**Maintenance Checklist (Weekly):**
- [ ] Update Section 5 metrics if changed
- [ ] Clean old backups (max 3): `bash scripts/cleanup-backups.sh`
- [ ] Verify tool exclusions (`.eslintignore`, `vitest.config.ts`)
- [ ] Check changelog is current

---

## 4. Quality Gates & Reference Commands
```bash
npm run build:check      # tsc -b + vite build
npx tsc -p tsconfig.strict.json --noEmit
npm run lint             # ESLint (strict rules)
npm test --run           # Vitest focused run
npm run test:real        # Integration tests w/ real services
npm run bundle:report    # Bundle size analysis
npm run lighthouse       # Performance budget verification
```
`npm run build:check` now runs the strict profile first. **MUST ADD**: Husky pre-commit hook to run `npm run typecheck:strict && npm run lint` before committing.

---

## 5. Current Status - POST SENIOR ENGINEER AUDIT (2025-09-29)

### 🚨 AUDIT FINDINGS - BRUTAL REALITY CHECK

**Audit Completed**: 2025-09-29
**Auditor Perspective**: Apple/Google/Microsoft Senior Principal Engineer
**Overall Grade**: **D+ (30/100)** - NOT ENTERPRISE READY
**Actual Completion**: **25-30% toward world-class** (audit-verified, not aspirational)

### Quality Gate Comparison (World-Class Standards)

| Metric | Apple/Google/MSFT | WealthTracker | Status |
|--------|-------------------|---------------|---------|
| ESLint Errors | 0 | **0** (was 624) | 🟢 PASSED |
| ESLint Warnings | <50 | **2,135** (was 24,184) | 🟡 MAJOR |
| TypeScript Strict | 0 | 0 | 🟢 EXCELLENT |
| "as any" Count | 0 | **245** (116 files) | 🔴 CRITICAL |
| Float in Finance | 0 | **158 files** | 🔴 COMPLIANCE |
| Test Pass Time | <30s | **~7min** (248 suites, 71 failing) | 🔴 NEEDS WORK |
| Test Coverage | >80% | **938 passing / 150 failing** (partial) | 🔴 UNKNOWN |
| Bundle (gzip) | <200KB | **580KB** (was 390KB) | 🔴 PERFORMANCE |
| Security | Excellent | Excellent (8/10) | 🟢 WORLD-CLASS |

### 6 Critical Enterprise Blockers (ChatGPT-Verified 2025-09-29)

**🚨 CRITICAL DISCOVERY** (ChatGPT Second Opinion):
Lint/test catastrophe is **partially inflated by backup directories**. Multiple `src.backup.*` folders are being scanned by ESLint and Vitest, artificially multiplying problem counts. **Phase 0 (Repository Hygiene) is now mandatory first step** before accurate assessment possible.

**BLOCKER #1: Repository Hygiene** 🚨 **NEW - DO THIS FIRST**
- Multiple `src.backup.*` directories polluting lint/test metrics
- Backup dirs not excluded from `.eslintignore` or `vitest.config.ts`
- **ChatGPT Finding**: ~90% of problems are duplicate scans of old code
- **Impact**: Cannot get accurate baseline, wasting effort on ghost issues
- **Fix Effort**: 4-6 hours
- **Action**: Delete old backups OR exclude from tools, then re-baseline

**BLOCKER #2: Linting Issues** 🟡 (Manageable but still open)
- **Before Phase 0**: 624 errors + 24,184 warnings = 24,808 problems
- **Current Baseline**: **32 errors + 2,135 warnings = 2,167 problems**
- **Improvement**: 22,641 problems eliminated (91.3% total, 94.9% errors)
- **Remaining error breakdown (32 total)**:
  - `no-restricted-imports` (Chart.js legacy imports): 14
  - `react-hooks/rules-of-hooks`: 5
  - `no-case-declarations`: 6
  - `@typescript-eslint/no-unsafe-function-type`: 5
  - `@typescript-eslint/no-require-imports`: 2
- World-class standard: 0 errors, <50 warnings
- **Impact**: Truly fixable; targeted cleanup required ASAP
- **Fix Effort**: 8-16 hours (post-cleanup)

**BLOCKER #3: Financial Calculation Safety** 🚨 (Confirmed Accurate)
- **Original audit**: 158 files using `parseFloat()`, `toFixed()`, `Math.round()`
- **ChatGPT Verification**: 162 parseFloat hits, 358 toFixed hits (confirms scope)
- Violations: `src/utils/currency.ts:70`, `src/types/money.ts:8`
- **Impact**: Compliance violation, legal liability, cannot pass SOC 2/PCI-DSS
- **Fix Effort**: 80-100 hours (unchanged - this is real)

**BLOCKER #4: Type Safety Bypassed** 🚨 (Confirmed Accurate)
- **Original audit**: 245 `as any` across 116 files
- **ChatGPT Verification**: Exact match - 245 occurrences (confirms accuracy)
- Complete bypass of TypeScript protection in service responses, contexts
- **Impact**: Runtime errors hidden, refactoring dangerous, high production risk
- **Fix Effort**: 60-80 hours (unchanged)

**BLOCKER #5: Testing Infrastructure** 🚨 (Revised Understanding)
- **Current**: `vitest --run` executes **248 suites (177 passed / 71 failed)** in ~7 minutes; dominant failures stem from Supabase auth (`PGRST100`), Redux slices missing store/providers, analytics services expecting real workers, and brittle console expectations.
- **Root Cause**: Backup directories previously inflated results; remaining failures are genuine configuration gaps (auth env, store harness) plus noisy assertions.
- **Target**: Deterministic <30s smoke suite + stable integration tests backed by Supabase test harness.
- **Impact**: Cannot verify quality or ship until Supabase credentials + store/test factories are wired and brittle tests are rewritten or removed.
- **Fix Effort**: 60-80 hours focused on authentication harness, shared test store utilities, and pruning console-based expectations.

**BLOCKER #6: Bundle Size Performance** 🚨 (Revised Metrics - ChatGPT Correction)
- **Original claim**: React core 390KB gzip
- **ChatGPT Correction**: React core is actually **46KB gzip** ✅ (excellent progress!)
- **Actual current state**: Initial load ~580KB gzip (vendor-shared 0.58MB + index 0.13MB)
- **Target**: <200KB gzip
- **Gap**: ~3x over target (better than originally thought, but still significant)
- **Impact**: Slow mobile experience, but improving
- **Fix Effort**: 40-60 hours (unchanged)

### What's Actually World-Class ✅

1. **Security** (8/10) - Genuinely Apple/Google level
   - XSS protection, input sanitization, Sentry integration
2. **TypeScript Strict** (10/10) - 0 errors shows discipline
3. **Stack Choices** (9/10) - Modern, scalable choices
4. **Documentation** (7/10) - Above average

### The Brutal Truth

**Would this pass Apple/Google/Microsoft code review?**
**NO.** Immediate rejection due to:
- 624 linting errors (0 is the standard)
- Floating-point in financial code (compliance violation)
- 245 type bypasses (indicates shortcuts)
- Broken testing (cannot verify quality)

**Time to Enterprise Ready**: 470-630 hours (12-16 weeks single engineer) - revised down after ChatGPT analysis
**With 2-3 Engineers**: 6-8 weeks to world-class (revised from 2-3 months)

**Current Build Status (POST PHASE 0 + QUICK WINS + Phase 1 Lint pass):**
- ✅ TypeScript strict: 0 errors
- 🟢 **ESLint: 0 errors, 2,135 warnings** (errors fully cleared on 2025-09-30)
  - Warnings audit scheduled for Phase 3 (type safety)
- 🟡 **Tests: 248 suites (177 passed / 71 failed) in ~7min** – failures cluster around Supabase auth (PGRST100) and Redux slices missing store wiring
- 🟡 Bundle: 580KB gzip (3x over 200KB target, but improving)
- React core: 46KB gzip ✅ (excellent)
- Latest: `vendor-plotly` 1.24MB (0.42MB gzip), `vendor-export` 1.14MB (0.35MB gzip)

**Phase 0 Complete + Quick Wins:** Removed 7 backups (77MB saved), fixed 51 regex errors, fixed 3 console.log, fixed 1 case declaration, excluded backups from tools. **Only 32 actionable errors remain.**
Backups available: 3 most recent under `src.backup.*` (max policy enforced).

---

## 6. Roadmap to World-Class (Audit-Driven Priorities)

**📚 EXECUTION DOCUMENTATION**:
- **Phase 0**: See `docs/PHASE0_COMPLETION_REPORT.md` (COMPLETE ✅)
- **Phase 1**: See `docs/PHASE1_ACTION_PLAN.md` (IN PROGRESS with ChatGPT)
- **Phase 2**: See `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md` (AUDIT COMPLETE - Ready for execution)
- **Phase 3**: See `docs/PHASE3_TYPE_SAFETY_AUDIT.md` (AUDIT COMPLETE - Ready for execution)
- **Phase 4**: See `docs/PHASE4_BUNDLE_DEEP_DIVE.md` (AUDIT COMPLETE - Ready for execution)
- **Phase 5**: TBD after Phase 4

**NOTE**: Phases 2-4 are **fully audited and planned** - no discovery work needed when starting execution.

---

### PHASE 0: REPOSITORY HYGIENE (4-6 hours) 🚨 **MANDATORY FIRST STEP**
**Goal**: Get accurate baseline metrics by cleaning tool pollution
**Exit Criteria**: Lint/test tools only scan active code, accurate problem counts

**Discovery**: ChatGPT second opinion (2025-09-29) revealed that backup directories (`src.backup.*`) are inflating metrics by ~90%. Must clean before proceeding with any other work.

1. **Clean Backup Directories** (2 hours) - BLOCKER REMOVAL
   ```bash
   # Option A: Delete all old backups (recommended for clean start)
   rm -rf src.backup.*

   # Option B: Move to archive outside src/
   mkdir -p ../wealthtracker-archives
   mv src.backup.* ../wealthtracker-archives/

   # Option C: Keep max 3 recent backups, exclude from tools
   bash scripts/cleanup-backups.sh
   ```

2. **Update Tool Exclusions** (1 hour)
   - Add `src.backup.*` and `dist/` to `.eslintignore`
   - Add `src.backup.*` to `vitest.config.ts` exclude array
   - Verify `.gitignore` excludes backups
   - Test: `npm run lint` should only scan src/ (not backups)

3. **Establish Clean Baseline** (1 hour)
   ```bash
   npm run lint 2>&1 | tee logs/lint-clean-baseline-$(date +%Y%m%d).log
   npm run test -- --run 2>&1 | tee logs/test-clean-baseline-$(date +%Y%m%d).log
   npm run typecheck:strict 2>&1 | tee logs/tsc-clean-baseline-$(date +%Y%m%d).log
   ```

4. **Update Documentation** (30min-1 hour)
   - Update Section 5 metrics with actual numbers
   - Record baseline in `docs/recovery-status.md`
   - Update Phase 1-5 estimates based on reality

**Expected Outcome**:
- Lint errors: **624 → ~50-100** (90% reduction)
- Test runtime: **Timeout → <5 minutes**
- Test failures: **1,651 → <100** manageable failures
- **Accurate** problem counts to prioritize real work

**Deliverable**: Clean metrics, realistic roadmap, no tool pollution

---

### PHASE 1: STABILIZE QUALITY GATES (120-160 hours) 🚨 REVISED ESTIMATE
**Goal**: Fix real linting/testing issues (not duplicates from backups)
**Exit Criteria**: All quality gates pass, tests run reliably
**Note**: Estimates reduced from 200-240 hours based on Phase 0 cleanup revealing true scope

1. **Fix Linting** (20-40 hours) - REVISED DOWN FROM 80-100
   - Fix ~50-100 actual errors (after Phase 0 cleanup removes duplicates)
   - Address real issues: regex escaping in `vite.config.ts`, unused imports
   - Clean up remaining warnings with justification
   - Target: 0 errors, <50 warnings

2. **Fix Testing Infrastructure** (60-80 hours) - MOSTLY UNCHANGED
   - Fix real test failures (reducers without stores, Supabase stubs)
   - Add smoke test suite (`npm run test:smoke`)
   - Get suite running in <5 minutes
   - Generate working coverage reports
   - Note: Will be 80% faster after Phase 0 removes duplicate test scans

3. **Add CI/CD Quality Gates** (40-60 hours) - UNCHANGED
   - GitHub Actions: lint check (must pass)
   - GitHub Actions: test run (must pass, <30s)
   - GitHub Actions: bundle size check (fail if >200KB gzip)
   - GitHub Actions: TypeScript strict (must pass)
   - Husky pre-commit: `npm run typecheck:strict && npm run lint`

**Deliverable**: Automated enforcement, accurate metrics

---

### PHASE 2: FINANCIAL SAFETY COMPLIANCE (80-100 hours) 🚨 LEGAL REQUIREMENT
**Goal**: Make codebase compliant for financial software
**Exit Criteria**: Zero floating-point in financial code, audit trail operational
**Prerequisites**: Phase 1 complete (lint/tests stable)

**📋 EXECUTION GUIDE**: See `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md` for complete audit

**Audit Complete** (2025-09-29): 158 files categorized by risk, migration order defined, helper utilities specified.

1. **Decimal Migration** (80-100 hours) - COMPLIANCE VIOLATION
   - **Critical (28 files, 40-50h)**: Core utilities, transaction processing, budget/goal, imports
     - Priority 1: `src/utils/currency.ts`, `src/types/money.ts`, `src/utils/formatters.ts`
     - Priority 2: Transaction modals, import services, account operations
   - **High Risk (35 files, 25-30h)**: Debt, retirement, mortgage, portfolio calculations
   - **Medium Risk (45 files, 15-20h)**: Analytics, reports, widgets (display)
   - **Low Risk (50 files, 5-10h)**: Tests, performance utils (defer to Phase 5)

   **Migration Order**: Core utilities → Transactions → Budget/Goals → Investments → Analytics
   **Helper Utilities**: `decimal-helpers.ts`, updated `serializeForRedux`, Decimal formatters
   **See audit doc for**: File-by-file breakdown, dependency map, fix patterns, testing strategy

2. **Audit Trail Implementation** (40-60 hours) - COMPLIANCE REQUIREMENT
   - Add logging for all financial operations
   - Implement change tracking for transactions
   - Add compliance reporting hooks
   - Integrate with Sentry for financial events

**Deliverable**: SOC 2 / PCI-DSS compliant financial calculations

---

### PHASE 3: TYPE SAFETY RESTORATION (60-80 hours) 🚨 RUNTIME SAFETY
**Goal**: Eliminate all type system bypasses - ZERO "as any" tolerance
**Exit Criteria**: Zero "as any", proper type definitions throughout
**Prerequisites**: Phases 1-2 complete (stable lint/tests, Decimal migration done)

**📋 EXECUTION GUIDE**: See `docs/PHASE3_TYPE_SAFETY_AUDIT.md` for complete audit

**Audit Complete** (2025-09-29): 245 occurrences cataloged by pattern, difficulty assessed, migration strategy defined.

1. **Eliminate "as any"** (60-80 hours) - 245 VIOLATIONS FOUND

   **Pattern Breakdown** (9 categories):
   - **Redux Serialization** (45 occurrences, 15-20h) - Fix `serializeForRedux<T>` → eliminates 45 casts
   - **Form Event Handlers** (35 occurrences, 10-12h) - EASY - Type assertions with docs
   - **API Responses** (30 occurrences, 12-15h) - Create Supabase response types
   - **Error Handling** (25 occurrences, 10-12h) - Type guards for errors
   - **Third-Party Libs** (30 occurrences, 12-15h) - CryptoJS, DOMPurify type definitions
   - **Test Mocks** (40 occurrences, 8-10h) - Can defer to Phase 5
   - **Window Extensions** (15 occurrences, 5-8h) - Global interface declarations
   - **Event Listeners** (10 occurrences, 4-6h) - Custom event map
   - **Context Data** (15 occurrences, 6-8h) - Extend types or create specialized types

   **Quick Win**: Fix `serializeForRedux` first → 45 casts eliminated immediately
   **See audit doc for**: Pattern-by-pattern fixes, type definitions needed, copy-paste templates

2. **Add Type Testing** (20-40 hours)
   - Add dtslint or tsd for compile-time type tests
   - Verify type safety automatically
   - Prevent type regressions

**Deliverable**: 100% type-safe codebase with zero bypasses

---

### PHASE 4: PERFORMANCE OPTIMIZATION (40-60 hours) 🚨 USER EXPERIENCE
**Goal**: Meet <200KB gzipped initial load target
**Exit Criteria**: Initial bundle <200KB gzipped, Lighthouse >90
**Prerequisites**: Phases 1-3 complete (stable codebase for refactoring)

**📋 EXECUTION GUIDE**: See `docs/PHASE4_BUNDLE_DEEP_DIVE.md` for complete analysis

**Audit Complete** (2025-09-30): Current 580KB gz analyzed, optimization strategies defined, quick wins identified.

1. **Bundle Optimization** (40-60 hours) - 380KB TO ELIMINATE
   - **Week 1 (15-20h)**: Optimize vendor-shared (197KB → 122KB) - defer upload/crypto, audit lodash
   - **Week 2 (15-20h)**: Route code splitting (index 133KB → 80KB) - lazy load all routes
   - **Week 3 (10-15h)**: Defer vendor-charting (remove 123KB from initial load)
   - **Week 4 (10-15h)**: Plotly trace audit, tree-shaking, Lighthouse verification

   **Quick Wins Identified**: vendor-upload chunk (-30KB), defer Recharts (-70KB), remove unused Plotly traces (-30-60KB)
   **See audit doc for**: Vendor breakdowns, tree-shaking checklist, route splitting strategy

2. **Performance Monitoring** (integrated with optimization)
   - Add bundle size regression testing to CI
   - Add Lighthouse CI automation
   - Performance budget enforcement
   - Real-user monitoring (Web Vitals)

**Deliverable**: Apple-level fast first paint on slow networks (<200KB gzipped)

---

### PHASE 5: TEST COVERAGE (120-160 hours) 🚨 QUALITY VERIFICATION
**Goal**: >80% coverage for financial code
**Exit Criteria**: All financial calculations tested, critical flows covered

1. **Service Layer Tests** (60-80 hours)
   - Test all financial calculations (Decimal-based)
   - Test all data mutations
   - Test error handling paths
   - Test currency conversions

2. **Integration Tests** (40-60 hours)
   - Test critical user flows end-to-end
   - Test offline scenarios
   - Test error recovery
   - Test Supabase integration

3. **E2E Tests** (20-40 hours)
   - Add Playwright for critical paths
   - Add to CI/CD pipeline
   - Test across browsers

**Deliverable**: Verified quality, safe deployments

---

### TOTAL EFFORT ESTIMATE (Revised After ChatGPT Analysis)
- **Phase 0 (Repository Hygiene)**: 4-6 hours (0.5 days single engineer)
- **Phases 1-2 (Critical Blockers)**: 240-320 hours (6-8 weeks single engineer) - revised down
- **Phases 3-5 (Enterprise Polish)**: 280-400 hours (7-10 weeks single engineer)
- **Total**: 524-726 hours (13-18 weeks single engineer) - revised from 600-800
- **With 2-3 Engineers**: 6-8 weeks to world-class - revised from 2-3 months

**Reality Check**: You're 25-30% complete. Phase 0 will give accurate baseline. This is the roadmap to 100%.

---

## 7. World-Class Standards Checklist

Use this checklist to verify world-class readiness before any "enterprise ready" claims:

### Quality Gates (Apple/Google/Microsoft Standard)
- [ ] ESLint: 0 errors, <50 warnings
- [ ] TypeScript strict: 0 errors
- [ ] "as any" count: 0 (absolute zero)
- [ ] Tests: All pass in <30 seconds
- [ ] Test coverage: >80% for financial code
- [ ] Bundle size: <200KB gzipped initial load
- [ ] Lighthouse score: >90 on mobile
- [ ] Security audit: No critical/high vulnerabilities

### Financial Compliance
- [ ] Zero floating-point arithmetic in money calculations
- [ ] All amounts use Decimal.js
- [ ] Audit trail logs all financial operations
- [ ] Transaction atomicity enforced
- [ ] Currency conversions use exact math

### Code Quality
- [ ] No TODO/FIXME in committed code
- [ ] No console.log in production code
- [ ] No commented-out code
- [ ] All components have error boundaries
- [ ] All async operations have error handling

### Performance
- [ ] Initial load <3s on 3G
- [ ] Time to Interactive <5s on 3G
- [ ] Core Web Vitals: all green
- [ ] Bundle size monitored in CI
- [ ] No memory leaks detected

### Documentation
- [ ] README has setup instructions
- [ ] API endpoints documented
- [ ] Type definitions exported
- [ ] Architecture decisions recorded
- [ ] Deployment runbook exists

**Pass Criteria**: 100% checklist completion = World-class ready

---

## 8. Architectural & Coding Standards
- **Frontend stack:** React + TypeScript + Vite + Redux Toolkit + TailwindCSS.
- **Component pattern:** hooks at top, handlers next, JSX last (`src/components/*`).
- **Testing pattern:** Vitest + React Testing Library; use `vi` mocks sparingly, prefer real services.
- **Service pattern:** Export interfaces in `src/services/interfaces`. Implementations inject dependencies via `ServiceProvider`.
- **Decimal usage:** `Decimal.js` everywhere that handles currency; keep amounts as strings/`Decimal` until final presentation.
- **ID handling:** Clerk IDs must convert to DB UUIDs via `userIdService` before data access.
- **Security:** sanitize inputs via `security/xss-protection`, never trust browser input.
- **Performance:** Desktop-first responsive design; lazy-load heavy components; always verify Lighthouse budgets.
- **Type Safety:** ZERO `as any` - use proper type definitions, type guards, and refactor if needed.

---

## 9. Handoff & Daily Workflow Checklist
### Before Starting Work
- [ ] Read relevant codepaths; confirm understanding.
- [ ] Capture strict TS error count + ESLint count.
- [ ] Create fresh backup (`src.backup.YYYYMMDD_HHMMSS_description`).
- [ ] Review current enterprise blockers from audit

### During Work
- [ ] Make atomic changes; document rationale.
- [ ] Re-run strict `tsc` after each logical change.
- [ ] Keep log of error deltas and affected files.
- [ ] Update this bible if rules or priorities change.
- [ ] **NEVER** use `as any` - ask for help if stuck on types

### Before Committing / Handoff
- [ ] `npm run build:check`, `npm run lint`, `npm test --run` all succeed.
- [ ] `npm run bundle:report` reviewed; chunk growth justified.
- [ ] No `console.log`, no commented-out code, no `as any`.
- [ ] Documentation updated (`docs/`, this bible, changelog).
- [ ] Record final strict error count + ESLint count + summary.

### Emergency Protocol
1. Stop immediately when counts spike or build fails.
2. Restore latest backup.
3. Document cause, fix, and mitigation here.
4. Inform team before resuming.

---

## 10. Disaster Prevention & Lessons Learned
- **"Quick fix" finds** caused past 11k-error explosions. Never again.
- **"Cleanup" deletions** removed live components; archive instead of delete.
- **"Silence errors"** with `as any` masked runtime crashes; fix the root issue.
- **"Refactor in bulk"** created circular dependencies; redesign first, then execute incrementally.
- **"as any" shortcuts** create technical debt that becomes enterprise blockers.

---

## 11. Documentation Change Control
- Any adjustment to rules, procedures, or roadmap **must** be reflected here immediately.
- Append a brief entry to `## Changelog` with date, author, and summary.
- Full history maintained in `docs/CHANGELOG.md` for traceability.

### Maintenance Workflow – Keep Guidance Fresh

**Update Triggers** (immediate action required):
1. **Metrics change >10%** – Update Section 5 immediately
2. **Roadmap priorities shift** – Update Section 6 same day
3. **New enterprise blockers** – Update Section 5 immediately
4. **Tool configuration changes** – Update relevant sections
5. **Audit/review completion** – Update status and roadmap

**Weekly Maintenance** (every Monday or after major work):
- [ ] Review Section 5 metrics vs reality
- [ ] Clean old backups (max 3): `bash scripts/cleanup-backups.sh`
- [ ] Verify `.eslintignore` and `vitest.config.ts` exclude backups
- [ ] Update changelog with significant changes
- [ ] Run baseline: `npm run lint`, `npm run test -- --run`, `npm run bundle:report`

**Monthly Maintenance** (first day of month):
- [ ] Full audit of all sections vs codebase reality
- [ ] Update roadmap estimates based on progress
- [ ] Archive superseded docs to `docs/archive/`
- [ ] Update Session Reboot Prompt (§13) if priorities changed
- [ ] Verify world-class checklist (§7) progress

**Automated Maintenance**:
- Run `scripts/cleanup-backups.sh` weekly to maintain max 3 backups
- Update CLAUDE.md immediately after Phase completions
- Sync metrics in Section 5 after any major milestone

### Changelog
**Recent Changes** (last 2 weeks - full history in `docs/CHANGELOG.md`):
- 2025-09-30 – **PHASE 2-4 AUDITS COMPLETE ✅**: Created comprehensive pre-execution audits (54KB total). Phase 2: `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md` (16KB) - 158 files by risk, migration order. Phase 3: `docs/PHASE3_TYPE_SAFETY_AUDIT.md` (18KB) - 245 "as any" by pattern, fix templates. Phase 4: `docs/PHASE4_BUNDLE_DEEP_DIVE.md` (20KB) - 580KB→200KB strategy, vendor analysis, quick wins identified (vendor-upload chunk, defer Recharts, Plotly trim). All phases shovel-ready (author: Claude Code).
- 2025-09-30 – **Phase 1 Lint Pass ✅**: ChatGPT cleared 32 lint errors (restricted imports, hooks, cases, types). Added Supabase mock + Redux factory. Warnings deferred to Phase 3 (author: ChatGPT).
- 2025-09-29 – **PHASE 0 COMPLETE + QUICK WINS ✅**: Repository hygiene executed successfully. Removed 7 old backups (77MB saved), kept 3 most recent. Updated `eslint.config.js` and `vitest.config.ts` to exclude backups. Fixed 51 regex errors in `vite.config.ts`. **Initial Results**: ESLint 94.9% error reduction (624→32 errors), 91.3% total problem reduction (24,808→2,167). Tests run in ~7 min (248 suites; 177 pass / 71 fail) exposing real Supabase + store harness gaps. Created `scripts/cleanup-backups.sh` automation. Only 32 actionable lint errors remained (scheduled for Phase 1). Updated CLAUDE.md with accurate metrics (author: Codex).
- 2025-09-30 – **Phase 1 Lint Pass ✅**: Cleared the remaining 32 lint errors (restricted imports, hook ordering, case declarations, unsafe Function types). Added Supabase test mock + Redux store factory groundwork. Warnings (2,135) deferred to Phase 3 (author: Codex).
- 2025-09-29 – **CHATGPT VERIFICATION & PHASE 0 DISCOVERY**: Second opinion revealed backup directories (`src.backup.*`) inflating metrics by ~90%. Added Phase 0 (Repository Hygiene) as mandatory first step. Revised estimates: 524-726 hours (down from 600-800). Added automated backup management (`scripts/cleanup-backups.sh`, max 3 backups). Added weekly/monthly maintenance schedules. Updated all roadmap estimates based on ChatGPT findings (author: Codex).
- 2025-09-29 – **SENIOR ENGINEER AUDIT COMPLETED**: Comprehensive technical audit revealed actual completion at 25-30% toward world-class. Identified 6 critical enterprise blockers (expanded from 5). D+ grade (30/100). Audit report, roadmap, and world-class checklist added to CLAUDE.md. Absolute "as any" ban rule added (ZERO tolerance). Changelog moved to `docs/CHANGELOG.md` for clarity (author: Senior Engineer Audit).
- 2025-09-29 – Bundle optimization wave 4: Redirected Plotly D3 packages to vendor bundles, cutting shared payload to 0.58MB (0.20MB gzip) (author: Codex).
- 2025-09-28 – Integrated strict type-check into `npm run build:check`; strict profile passes with 0 errors (author: Codex).

_See `docs/CHANGELOG.md` for complete development history._

---

## 12. Quick Reference Appendix

### Audit Commands:
- **Find "as any":** `rg "as any" src` (Target: 0, Current: 245)
- **Find float usage:** `rg "parseFloat|toFixed|Math\.round" src` (Target: 0, Current: 158 files)
- **Audit TODOs:** `rg "TODO" src --iglob "*.ts*"` (Target: 0, Current: 4)
- **Check bundle:** `npm run bundle:report`
- **Run lint:** `npm run lint` (Current: 0 errors, 2,135 warnings)
- **Run tests:** `npm test -- --run` (Current: 248 suites, 177 pass, 71 fail)

### Phase Execution Guides:
- **Phase 0**: `docs/PHASE0_COMPLETION_REPORT.md` ✅ COMPLETE
- **Phase 1**: `docs/PHASE1_ACTION_PLAN.md` 🔄 IN PROGRESS (ChatGPT)
- **Phase 2**: `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md` ⏳ READY (16KB - 158 files cataloged)
- **Phase 3**: `docs/PHASE3_TYPE_SAFETY_AUDIT.md` ⏳ READY (18KB - 245 "as any" cataloged)
- **Phase 4**: `docs/PHASE4_BUNDLE_DEEP_DIVE.md` ⏳ READY (20KB - 580KB→200KB strategy)

### Maintenance:
- **Backup cleanup:** `bash scripts/cleanup-backups.sh` (weekly)
- **Backup restore:** `rm -rf src && cp -r src.backup.<timestamp> src`
- **Update metrics:** After any phase completion or >10% change

Stay disciplined. Every change either strengthens or weakens WealthTracker. Choose strengthening.

---

## 13. Session Reboot Prompt
When a conversation resets or a new assistant joins, paste this message:

```
You are resuming work on WealthTracker. IMMEDIATELY read `CLAUDE.md` (the Single Engineering Bible).

**CRITICAL CONTEXT**:
- Senior engineer audit (2025-09-29) + ChatGPT verification revealed D+ grade (30/100) - NOT enterprise ready
- **Phase 0 discovery**: Backup directories (`src.backup.*`) inflating metrics by ~90% - must clean first
- Actual completion: 25-30% toward world-class
- 6 critical blockers (Phase 0 hygiene is #1 priority)

**ABSOLUTE RULE**: ZERO `as any` tolerance - no exceptions, no approvals. Current: 245 violations.

**PRIORITY ORDER** (from dual audit):
1. ~~Phase 0: Repository hygiene~~ ✅ COMPLETE (2025-09-29)
2. **Phase 1: Quality gates** 🔄 IN PROGRESS with ChatGPT (32→0 errors, test harness, CI/CD)
3. **Phase 2: Financial Decimal migration** ⏳ READY (see `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md`)
4. **Phase 3: Eliminate "as any"** ⏳ READY (see `docs/PHASE3_TYPE_SAFETY_AUDIT.md`)
5. Phase 4: Bundle optimization
6. Phase 5: Test coverage

**📋 PHASE 2-3 EXECUTION GUIDES READY**:
- `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md` (16KB) - 158 files categorized, migration order, helpers
- `docs/PHASE3_TYPE_SAFETY_AUDIT.md` (18KB) - 245 occurrences cataloged, fix patterns, types needed

Review Section 5 (audit findings), Section 6 (roadmap), Section 7 (world-class checklist), and **audit documents before starting Phases 2-3**.
```

---

_Last comprehensive audit: 2025-09-29 | Next audit: After Phase 1-2 completion | Target: 100% world-class checklist_
