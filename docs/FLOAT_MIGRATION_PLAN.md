# Phase 2 – Floating-Point to Decimal Migration

## Goals
- Eliminate floating point usage in financial calculations.
- Ensure monetary values use `Decimal` or money value objects across the stack.

## Current findings
- Active tree is Decimal-only (`rg "parseFloat|toFixed|Math\.round" src | wc -l` → 0 as of 2025‑10‑18).
- Historical references now live only in documentation snapshots, archived bundles, and scripts; update or prune as needed and log each verification under `logs/decimal-migration/` (latest: `20251019_093250_rounding_audit.txt`).
- Outstanding hygiene items: retire workspace-era snapshots (see `WealthTracker-Backups/` archive: `all-code.txt`, `money-management-source-code.txt`, `bundle-stats.html`, `docs/bundle-stats.html`, `SESSION_SUMMARY.md`) and refresh bundle reports from the Decimal build.

## Strategy
1. **Audit validation** – confirm audit list matches current tree (run `rg 'parseFloat\('` etc.).
2. **Introduce Money helpers** – verify shared `@wealthtracker/utils` Decimal helpers, expand as needed (format, compare, addition, rounding). `src/utils/currency.ts` now proxies to the Decimal implementation; migrate remaining call sites to async helpers. Document usage in README.
3. **File-by-file migration**
   - Replace `number` money fields with Money type alias.
   - Swap `parseFloat` for Decimal constructors.
   - Use helper `formatCurrencyDecimal` for UI (avoid `.toFixed`).
   - Update tests with Decimal assertion helpers.
4. **Backend alignment** – ensure Supabase queries return decimals (review `supabase.sql`), update transformation layers.
5. **Regression tests**
   - Re-run `decimal-integration.test.tsx` suite.
   - Add integration test for rounding/currency conversions.

## Recent progress
- 2025-10-19 – Re-verified the Decimal sweep after snapshot cleanup; logged audit output in `logs/decimal-migration/20251019_093250_rounding_audit.txt`.
- 2025-10-18 – Archived backups removed; active codebase and tests audited clean. Remaining references exist only in documentation snapshots and utility scripts pending refresh.
- 2025-10-15 – Reporting services migrated to Decimal formatting: `financialSummaryService`, `advancedAnalyticsService`, and `budgetRecommendationService` now rely on shared rounding/percentage helpers for exports, insights, and recommendations. Follow-up `rg "parseFloat|toFixed|Math\.round" src` reports 309 hits, primarily in helper utilities, duplicate-detection analytics, and seed/test data queued for later sweeps.
- 2025-10-15 – Shared utility sweep completed for formatter and performance helpers: `utils/formatters`, `utils/performance-monitor`, and `utils/dynamic-imports` now log and display values via Decimal rounding. Post-update `rg "parseFloat|toFixed|Math\.round" src` returns 300 hits, concentrated in anomaly/dedup analytics, security/testing helpers, and demo data slated for the next batch.
- 2025-10-15 – Detection/forecast & duplicate surfaces reworked to Decimal: `anomalyDetectionService`, `cashFlowForecastService`, document storage stats, `DuplicateDetection`, `SplitTransaction`, `SavingsGoalsWidget`, `ExpenseCategoriesWidget`, `DebtTrackerWidget`, and `RecentAlertsWidget` now format amounts, intervals, and confidence percentages via shared helpers. Latest `rg "parseFloat|toFixed|Math\.round" src` reports 249 matches, centred on advanced investment analytics, split/testing utilities, and generator data reserved for the upcoming sweep.
- 2025-10-15 – `useActivityLogger`, `useGlobalSearch`, and `utils/reconciliation` now consume `parseCurrencyDecimal`/`formatCurrency` helpers for balances, budgets, goals, and reconciliation totals (no remaining `parseFloat`/`.toFixed` in those flows).
- 2025-10-15 – `utils/calculations.ts` re-routed through Decimal converters/functions for budgets, goal progress, account totals, trends, and category summaries; outputs still return numbers but now originate from `Decimal` math.
- 2025-10-15 – `AddAccountModal`, `BillManagement`, and `BudgetRollover` remove direct `parseFloat` usage in favor of `parseCurrencyDecimal`/`toStorageNumber`, ensuring new balances, bills, and rollover caps originate from Decimal conversions.
- 2025-10-15 – `CSVImportWizard` now normalizes balances via `parseCurrencyDecimal` + `toStorageNumber`, eliminating ad-hoc `parseFloat` sanitizers when importing accounts.
- 2025-10-15 – `SharedBudgetsGoals` renders shared budget/goal percentages and member totals using Decimal math (no `.toFixed` for money/percentages); UI formatting now flows through `formatCurrency`.
- 2025-10-15 – `SpendingAlerts` uses Decimal-derived percentages for threshold checks, stats, and alert copy, removing `.toFixed` formatting from notifications.
- 2025-10-15 – `DividendTracker` per-share displays now come from `parseCurrencyDecimal` decimals, keeping mobile/table views off native `.toFixed`.
- 2025-10-15 – `PortfolioAnalysis` percent-based metrics, rebalancing summaries, and allocation bars now compute and render via Decimal helpers instead of `Math.abs(...).toFixed`.
- 2025-10-15 – `RealTimePortfolio` replaces `.toFixed` on returns, share counts, gains, and allocations with Decimal rounding, keeping live analytics consistent.
- 2025-10-15 – `PortfolioOptimizer` feeds chart data, tooltips, and advanced inputs through Decimal percentage helpers (risk, return, weights, rates) eliminating `Number(...toFixed())` conversions.
- 2025-10-15 – `PortfolioRebalancer` now formats allocation charts, difference callouts, rebalance actions, and target totals with Decimal helpers instead of `.toFixed`.
- 2025-10-15 – `RealTimePortfolioEnhanced` renders live gain/day-change percentages and share counts with Decimal rounding rather than `.toFixed`.
- 2025-10-15 – `PortfolioManager` and `EnhancedPortfolioView` convert share counts and allocation/gain percentages to Decimal helpers across table, cards, and progress bars.
- 2025-10-15 – `InvestmentSummaryWidget` gains Decimal-based return percentage formatting, eliminating the last `.toFixed` in that widget.
- 2025-10-15 – Investment widgets (`InvestmentSummaryWidget`, etc.) continue to emit number-formatted strings; remaining `.toFixed` there scheduled in next sweep.
- 2025-10-15 – Completed Decimal migration for `TaxPlanningWidget`, `BusinessWidget`, `FinancialPlanningWidget`, `ExpenseBreakdownWidget`, `NetWorthWidget`, and `CashFlowWidget`, replacing legacy `.toFixed` percentage displays with shared helpers while keeping chart feeds numeric-safe.
- 2025-10-15 – Enhanced export/report generators (`EnhancedExportManager`, `exportService`, CSV helpers) now format currency and percentage values via Decimal utilities across PDF, Excel, CSV, and QIF outputs; remaining `toFixed` hits live outside Phase 2 scope (see `rg parseFloat|toFixed|Math.round`).
- 2025-10-15 – Budget comparison dashboards, PDF statement exports, and the Net Worth Trend widget now source percentage badges and tooltips from Decimal helpers, removing additional `.toFixed` usage from analytics surfaces.
- 2025-10-15 – Debt management and budget summary views, plus the Excel budget export, now derive interest rates, progress bars, and percentage columns from Decimal math, clearing another batch of `.toFixed` usage in user-facing finance flows.
- 2025-10-15 – Spending insights and smart categorization UIs render confidence/proportion metrics through Decimal helpers, removing the final percentage `.toFixed` calls in those AI-driven dashboards.
- 2025-10-15 – Financial summary cards and realtime alerts now surface savings rates, comparison deltas, and 24h portfolio change via Decimal formatting, retiring the remaining `.toFixed` usage in executive dashboards.
- 2025-10-15 – Merchant enrichment stats, document upload size displays, and import wizards now rely on Decimal helpers for confidence and file-size formatting, replacing the remaining `Math.round`/`.toFixed` cases across those flows.
- 2025-10-15 – Performance dashboards and net-worth charts now format time/percentage axes via Decimal utilities, eliminating the last float-based rounding in monitoring visuals.
- 2025-10-15 – Batch import workflow, usage warnings, and categorization settings now derive progress/confidence metrics from Decimal helpers, removing dashboard `.toFixed`/`Math.round` remnants in import and subscription experiences.
- 2025-10-15 – Cash flow widget percentages, import progress indicators, and AI settings now render via Decimal helpers, replacing lingering `.toFixed`/`Math.round` usage across budgeting dashboards.

## Metrics to track
- `rg 'parseFloat\ '|wc -l`
- `rg 'toFixed\('|wc -l`
- Type errors after `npm run typecheck:strict`

## Risks
- Breaking form validation (string ↔ Decimal conversions).
- Performance regression if Decimal used excessively in render.
- API contract mismatches (server expects number).

## Next steps
- Update audit spreadsheet after first batch of conversions.
- Define coding guideline doc for Decimal usage in contributor docs.
