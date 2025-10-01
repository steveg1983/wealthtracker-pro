# WealthTracker Development Changelog

**Purpose**: Historical record of all significant code changes, optimizations, and fixes.
**Note**: Recent entries (last 2 weeks) are kept in `CLAUDE.md` for quick reference.

---

## September 2025

### 2025-09-29 - Bundle Optimization Wave 4
- Redirected Plotly's internal D3 packages and export codecs into dedicated vendor bundles, cutting shared payload to ~0.58 MB (0.20 MB gzip) while keeping analytics/export routes lazy (author: Codex)
- Replaced remaining direct `lodash` imports with `lodash-es` for tree-shaking and added `@types/lodash-es` (author: Codex)
- Split additional vendor families (`vendor-react-router`, `vendor-react-grid-layout`, `vendor-virtualization`, `vendor-dnd`, `vendor-icons`, `vendor-floating-ui`, `vendor-auth`, `vendor-sentry`, `vendor-motion`) and aligned Rollup output naming for diagnostics; shared payload now ~0.92 MB (0.30 MB gzip) (author: Codex)
- Deferred Analytics ag-grid CSS loading to explorer tab and ensured manual chunk IDs surface in emitted filenames for faster bundle triage (author: Codex)

### 2025-09-29 - Bundle Optimization Wave 3
- Introduced vendor manual chunk groups (`vendor-plotly`, `vendor-export`, etc.) and lazy-loaded export libraries so `jspdf`/`xlsx` stay out of the main bundle (author: Codex)
- Swapped Plotly loader to `react-plotly.js/factory` + `plotly.js-dist-min`, shaving ~240 KB from Plotly chunk and capturing latest bundle report (`bundle-size-report.json`) (author: Codex)
- Replaced Plotly dependency with bespoke registry (`src/lib/plotlyLight.ts`) so only required traces ship; Plotly vendor chunk now ~1.63 MB (0.55 MB gzip) (author: Codex)
- Trimmed unused 3D Plotly traces from registry, reducing Plotly vendor chunk to ~1.31 MB (0.44 MB gzip) (author: Codex)

### 2025-09-29 - Service Layer Optimization
- Deferred `analyticsEngine`/`anomalyDetectionService` loading inside `Analytics` so heavy D3/statistics stack stays off initial bundle; insights hydrate services on demand (author: Codex)
- `exportService` now reuses shared `importXLSX` helper (workbook creation + download), eliminating duplicate XLSX chunks when reports run (author: Codex)
- ChartWizard sheds static `analyticsEngine` dependency; analytics math now loads only when page resolves services, keeping vendor React chunk leaner (author: Codex)

### 2025-09-29 - Vendor Chunk Splitting
- Added `vendor-analytics` manual chunk (ml-matrix/simple-statistics/regression) so analytics math bundles separately and hydrates lazily with analytics page (author: Codex)
- Added `vendor-react-core` manual chunk (react, react-dom, scheduler) so React core ships in its own 1.23 MB/0.39 MB gzip payload, leaving shared application chunk leaner (author: Codex)
- Added `vendor-date-fns` manual chunk, isolating `date-fns` (~1.13 MB, 0.34 MB gzip) and removing it from shared application payload (author: Codex)

### 2025-09-29 - Build Pipeline Fixes
- Eliminated PostCSS `from` warning by patching Tailwind's bundled PostCSS input handling and Vite's URL rewriter (captured in `/patches` via `patch-package`); build now runs clean with strict typecheck gating (author: Codex)

### 2025-09-28 - Import Harmonization
- Harmonised Supabase imports (centralised client in `src/lib/supabase.ts`, added live subscription bridge in `supabaseClient`, and converted `userIdService` to static imports); builds now only warn about PostCSS and security modules (author: Codex)
- Removed dynamic loggingService imports (serviceFactory/BaseService/color-contrast audit) so build no longer warns about logger mixing; Supabase + PostCSS warnings flagged for next pass (author: Codex)

### 2025-09-28 - Performance Documentation
- Captured current bundle baseline (`bundle-size-report.json`) and published `docs/performance/bundle-optimization-plan.md`; highlights vendor chunk split, export tool lazy-loading, and PostCSS warning follow-up (author: Codex)
- Hard-typed Analytics grid columns, refreshed `vite.config.ts` to satisfy plugin typings, and verified `npm run build:check` so strict gating now executes cleanly (author: Codex)

### 2025-09-28 - Strict TypeScript Integration
- Integrated strict type-check into `npm run build:check`, added `npm run typecheck:strict` and `npm run verify:ci` guardrails, and refreshed bible to highlight new verification flow (author: Codex)
- Eliminated remaining strict TypeScript violations across sync, tax, retirement, mortgage, and storage services; strict profile now passes with 0 errors (`logs/tsc-20250928_233104.log`) (author: Codex)

### 2025-09-28 - Type System Hardening
- Replaced smart cache's dependency on external LRU module with typed in-house wrapper (adds synchronous peek helpers and respects TTL), serialised storageAdapter writes/reads through `JsonValue`, and captured 49-error strict baseline (`logs/tsc-20250928_224504.log`) (author: Codex)
- Normalised household local-storage hydration (members/invites/activities now emit defined IDs/dates) and tightened import rules loading/updating with typed condition/action sanitisation; strict errors down to 62 (`logs/tsc-20250928_220207.log`) (author: Codex)

### 2025-09-27 - Component Hardening
- Haptic feedback hook now guards browser APIs, exports value-friendly pattern map, and keyboard shortcuts dispatch sync event instead of missing toast; strict errors down to 866 (`logs/tsc-20250927_141531.log`) (author: Codex)
- Decimal budget types now extend Supabase budgets (with legacy `category` helper), converters/tests updated, and strict counter drops to 884 (`logs/tsc-20250927_135106.log`) (author: Codex)
- Theme token utilities coerce CSS values safely, diagnostic report now typed with explicit snapshots, and activity logger respects `categoryId` budgets; strict errors down to 890 (`logs/tsc-20250927_154733.log`) (author: Codex)
- Default test budgets now expose `categoryId`, required timestamps, and `spent` totals so strict payloads are valid; strict errors down to 907 (`logs/tsc-20250927_153437.log`) (author: Codex)
- Hardened Auth/Sentry sync flow, typed preferences setters, aligned realtime analytics provider with service contracts, and cleaned default holdings/transactions for strict optional compliance; strict errors now 912 (`logs/tsc-20250927_143007.log`) (author: Codex)

### 2025-09-26 - Financial Component Updates
- Portfolio Rebalancer target management now uses typed payloads, sanitized allocations, and Supabase-aware updates; realtime alerts reflect analytics types with Decimal-safe formatting and provider exposes connection status via ReturnType (author: Codex)
- Updated FinancialGoalTracker flows, ensured both goal modals emit Supabase-safe payloads, and fixed FixSummary grouping; strict errors now 1,486 (`logs/tsc-20250926_214718.log`) (author: Codex)
- Tightened Excel export grouping, ensured ExpenseSplitModal emits percentage values safely, and made ExportModal date handling/groupBy compliant with strict optional rules (strict errors now 1,519; `logs/tsc-20250926_205616.log`) (author: Codex)
- Hardened EnhancedTransferModal metadata handling, EnvelopeBudgeting budget creation, and ErrorBoundary overrides/reset logic; strict errors now 1,543 (`logs/tsc-20250926_202845.log`) (author: Codex)

### 2025-09-26 - Type Safety Improvements
- Guarded dropzone accept handling, stabilized debt credit score comparisons, and aligned debt payoff planner with Supabase financial plan types (strict errors now 1,850) (author: Codex)
- Fixed DebugErrorBoundary overrides/logging and sanitized dividend tracker imports/add/update flows (strict errors now 1,841) (author: Codex)
- Safeguarded net worth trend history, normalized dashboard widget refresh intervals, and aligned data intelligence verification with service getters (strict errors now 1,883) (author: Codex)

### 2025-09-26 - Component Type Fixes
- Fixed strict regressions across BottomSheet, BudgetRecommendations, BulkTransactionEdit, CashFlowForecast, CategorySuggestion, and chart infrastructure (custom in-view observer, safe color handling, guarded tooltips); strict errors down to 2,098 (author: Codex)
- Hardened account selector/settings modals plus add-investment/transaction flows to respect exact optional types; strict errors down to 2,277 (author: Codex)
- Shifted realtimeService onto ensureSupabaseClient, added stub guards, and corrected goal subscription filters; strict errors now 2,269 (author: Codex)
- Converted useDashboardLayout to lazy Supabase client with SSR-safe local storage fallbacks; strict errors now 2,242 (author: Codex)

### 2025-09-26 - Form & Import Hardening
- Normalised balance adjustments, bank API/format selectors, and batch import flows for strict typing (author: Codex)
- Typed CSV import wizard end-to-end (transaction/account branches), guarded mobile list virtualization, and tightened natural-language date parsing; strict errors down to 1,977 (author: Codex)

### 2025-09-25 - Service Infrastructure
- Restored strict tsconfig gate (now 2,290 errors) and cleaned AppWrapper, lazy preload util, accessibility dashboard, and reconciliation chart typings (author: Codex)
- Extended autoSyncService to lazy Supabase guardrail and SSR-safe storage fallbacks (author: Codex)
- Refined Dashboard Supabase checks and localStorage usage with lazy client resolution and SSR-safe guards (author: Codex)
- Hardened RealtimeSyncTest with lazy Supabase resolution, bounded event history, and deterministic cleanup (author: Codex)
- Updated RealtimeDebugger to defer Supabase resolution, add SSR-safe window guards, and cleanly dispose realtime channels (author: Codex)

### 2025-09-25 - Service Migration
- Converted dataMigrationService to lazy Supabase guardrail, centralized migration flags, and retired window-based ID state (author: Codex)
- Hardened dashboardWidgetService with lazy Supabase client guardrail and SSR-safe localStorage fallbacks (author: Codex)
- Converted SupabaseSubscriptionService to lazy Supabase client guardrail and verified focused Vitest suite (author: Codex)

### 2025-09-25 - Major Type System Cleanup
- Fixed 114+ TypeScript errors through systematic leaf component fixes: IconBase exports, ErrorBoundary logger/overrides, type-only imports (ReactNode/ErrorInfo/DragEvents), FormFieldWrapper optional properties, accessibility utilities null checking, decimal calculations safety, BottomSheet touch handling, logger declarations, Skeleton props, utility function null safety, exactOptionalPropertyTypes compliance, broken comment pattern elimination, virtualization safety, and 15 missing component/hook/service stubs (2516 → 2402 errors) (author: Claude Code)

### 2025-09-25 - Testing Infrastructure
- Stubbed Supabase client for Node contexts and lazily import real client only in browsers; script still OOMs until remaining imports shrink (author: Codex)
- Added injectable harnesses to `budgetService`/`goalService`, documented heavyweight sanity script, and noted Vitest OOM blocker pending storage/supabase slimming (author: Codex)
- Routed budget/goal services through `userIdService`, cleaned imports, and documented Vitest OOM blocker for their coverage (author: Codex)
- Added `userIdService.__testing`, rewrote Vitest/unit harness for identifier resolution, and refreshed sanity script + docs to reflect passing checks (author: Codex)

### 2025-09-24 - Data Layer Foundation
- Added `vitest.config.unit.ts` for focused service tests and documented execution constraints (author: Codex)
- Unified budget/goal services around Supabase UUID resolution and tightened docs/process focus on verifying new data layer (author: Codex)
- Wired Clerk↔UUID mapping, updated AppContext to use Supabase IDs for all create flows, and added transaction lookup against real Supabase rows (author: Codex)
- Documented data layer blockers (ID mapping, AppContext integration), reprioritized handoff focus, and aligned prompts (author: Codex)
- Consolidated `CLAUDE.md` and `CLAUDE_WORKFILE.md` into single engineering bible; updated recovery metrics and roadmap (author: Codex)

---

_For recent changes (last 2 weeks), see the Changelog section in `CLAUDE.md`_