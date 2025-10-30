# Regression Audit – 2025-11-01

Target journeys: **Dashboard**, **Budgeting**, **Data Imports**.

## Commands Executed

| Journey | Command | Result |
| --- | --- | --- |
| Dashboard widgets & navigation | `npx vitest run src/test/integration/DashboardInteractionsIntegration.test.tsx --environment jsdom` | ✅ Passing (log: `logs/quality-gates/20251101_dashboard-vitest.log`) – retains harmless jsdom `window.scrollTo` warning. |
| Budget workflows | `npx vitest run src/test/integration/BudgetWorkflowIntegration.test.tsx --environment jsdom` | ✅ Passing (log: `logs/quality-gates/20251101_budget-vitest.log`) – `window.scrollTo` warning noted; schema-aligned fixtures verify restored category names. |
| Import modals (CSV/OFX/QIF/batch) | `npx vitest run src/components/ImportDataModal.test.tsx src/components/CSVImportWizard.test.tsx src/components/OFXImportModal.test.tsx src/components/QIFImportModal.test.tsx src/components/BatchImportModal.test.tsx --environment jsdom` | ✅ Passing (log: `logs/quality-gates/20251101_import-vitest.log`). |
| Supabase smoke (real DB) | `npm run test:supabase-smoke` | ✅ Passing (manual verification during this run; see CLI output in session). |

## Key Updates Since 2025-10-29

1. **Centralised logging restored**  
   Reintroduced `src/services/loggingService.ts` to support the professional icon system and shared code paths. Vitest runs now consume a single, spill-safe logger instead of direct `console` usage.

2. **Budget UI regression resolved**  
   Budget cards display category names again by normalising `categoryId` / legacy `category` fields and cross-referencing the category catalogue. Local fixtures were updated to write to `money_management_*` keys and include UUID-aligned schema (`categoryId`, `updatedAt`, `spent`).

3. **Supabase schema linting enforced**  
   CI now executes `npx supabase db lint --linked --fail-on error`. The UUID helper migration (`202511010905__uuid-function-params.sql`) and conflict constraint update (`202511010912__subscription-usage-uuid-constraint.sql`) keep lint output clean.

## Observations

- Added a `window.scrollTo` shim in `src/test/setup.ts` to eliminate jsdom noise while preserving modal behaviour.
- Dashboard, budget, and import journeys rely on restored Tabler icon bundle; the logger guard prevents unresolved import errors during SSR/Vitest startup.
- Supabase smoke suite validates DELETE RLS policy (anon deletions blocked) and end-to-end CRUD flows with live credentials.

## Recommended Follow-up

1. Add a quick regression around `categoryNameById` to lock in the new compatibility path (legacy `category` vs. `categoryId`).
2. Monitor nightly Supabase workflow for lint failures now that the CLI check is in place.

Logs are stored beside earlier audits for easy diffing under `logs/quality-gates/`.
