
---

## 2025-11-02 - Notification Suite Pass (ChatGPT)

**Branch:** decimal-migration-restore

**Scope:** Cleaned the notification bell/center stack and supporting shared hooks.

**Commands run:**
```bash
npx eslint src/components/NotificationBell.test.tsx src/components/NotificationBell.tsx src/components/NotificationCenter.tsx
npm run lint
```

**Highlights:**
- Trimmed unused helpers in the bell tests and tightened mock signatures (`src/components/NotificationBell.test.tsx:1`).
- Removed stale imports, fixed message truncation, and kept dropdown state tidy in `src/components/NotificationBell.tsx:1`.
- Reworked `NotificationCenter` with typed filter guards, memoised icon/time helpers, stable rule handlers, and a lightweight placeholder editor so edit/create actions now surface UI (`src/components/NotificationCenter.tsx:1`).
- Added overlay hooks (e.g., `useBottomSheet`, `useInfiniteScroll`, `useKeyboardShortcutsHelp`) to keep fast-refresh happy across adjacent mobile modules touched in this pass.

**Result:** All notification-related warnings resolved; remaining lint noise is concentrated in import modals and portfolio dashboards.

---

## 2025-11-02 - Layout & Import Rules Cleanup (ChatGPT)

**Branch:** decimal-migration-restore

**Scope:** Knocked out additional eslint warnings across layout chrome, import-rule forms, and assorted UI/test helpers.

**Commands run:**
```bash
npx eslint src/components/Layout.tsx src/components/ImportRulesManager.tsx \
  src/components/IncomeVsExpensesChart.test.tsx src/components/InsurancePlanner.tsx \
  src/components/MarkdownEditor.tsx src/components/MerchantLogo.tsx \
  src/components/LazyErrorBoundary.tsx src/components/LazyLoadWrapper.tsx \
  src/components/KeyboardShortcutsHelp.tsx src/hooks/useKeyboardShortcutsHelp.ts
npm run lint
```

**Highlights:**
- Added stable callbacks for sidebar/mobile toggles and trimmed unused `showBudget` flag in `src/components/Layout.tsx:121`, clearing the hook dependency warning.
- Removed the dormant `testMode` state and replaced every `as any` select handler in `src/components/ImportRulesManager.tsx:23`, introducing typed guards for fields/operators/actions.
- Addressed lingering test noise (`IncomeVsExpensesChart.test.tsx:389` unused `rerender`) and renamed ignored props (`InsurancePlanner.tsx:8`, `MerchantLogo.tsx:76`).
- Split `useKeyboardShortcutsHelp` into `src/hooks/useKeyboardShortcutsHelp.ts:1` to silence the fast-refresh rule and memoised the hook’s callbacks.
- Tightened supporting utilities: no more `window as any` in `LazyErrorBoundary`, IntersectionObserver cleanup in `LazyLoadWrapper`, and icon imports trimmed in `MarkdownEditor`.

**Result:** Another 12 warnings eliminated; fresh `npm run lint` now flags a slimmer list focused on import/export utilities and mobile dashboards.

---

## 2025-11-02 - Global Search & Household Cleanup (ChatGPT)

**Branch:** decimal-migration-restore

**Scope:** Reduced another batch of eslint warnings across search UX, household management, and high-noise test files.

**Commands run:**
```bash
npx eslint src/components/ErrorBoundary.test.tsx src/components/ExpenseSplitModal.test.tsx \
  src/components/FixSummaryModal.test.tsx src/components/FloatingActionButton.tsx \
  src/components/GlobalSearch.tsx src/components/GoalCelebrationModal.test.tsx \
  src/components/GoalModal.test.tsx src/components/HelpTooltip.tsx \
  src/components/HouseholdManagement.tsx src/components/ImportDataModal.test.tsx
npm run lint
```

**Highlights:**
- Deleted the unused `EnhancedFloatingActionButton` scaffolding and tightened the primary FAB component.
- Split `useGlobalSearchDialog` into `src/hooks` and memoised keyboard handlers to satisfy `react-hooks/exhaustive-deps`.
- Converted the help tooltip dictionary to an internal constant so the module only exports components (silencing `react-refresh/only-export-components`).
- Typed household member invite/role flows (`HouseholdInvite`, `MemberContribution`) and replaced `as any` casts with safe parsers.
- Pruned unused Vitest helpers across expense/goal/error modal suites and corrected icon mocks to avoid unused argument noise.
- Added `src/hooks/useGlobalSearchDialog.ts` with stable callbacks for Layout and tests to consume.

**Result:** Targeted files lint clean; full `eslint .` warning count down by 24 with remaining noise concentrated in import/export and analytics modules.

---

## 2025-10-02 - Insights Dashboard Type Cleanup (ChatGPT)

**Branch:** decimal-migration-restore

**Scope:** Remove remaining `as any` usage in the insights dashboard and customizable dashboard widget factory.

**Commands run:**
```bash
npx eslint src/components/DataInsights.tsx src/components/CustomizableDashboard.tsx
npm run lint
```

**Files changed (2 total):**
- `src/components/DataInsights.tsx` – added typed filter/sort helpers so select handlers no longer rely on `as any` casts.
- `src/components/CustomizableDashboard.tsx` – defined `AvailableWidgetType` alias and removed the widget creation cast.

**Result:**
- ✅ Eliminated 2 `@typescript-eslint/no-explicit-any` warnings in the insights dashboard filters.
- ✅ Removed 1 `@typescript-eslint/no-explicit-any` warning when adding new dashboard widgets.
- Global lint baseline: `0 errors / 1,742 warnings` (down from 1,761 prior to this pass).

**Verification:**
```bash
npx eslint src/components/DataInsights.tsx src/components/CustomizableDashboard.tsx
npm run lint
```
