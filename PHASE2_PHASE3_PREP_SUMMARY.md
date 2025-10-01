# Phase 2–3 Prep Summary

_Date: 2025-09-30_

This note captures the high-level inventory needed before we start the next phases. It is purely informational and does not replace the detailed plans in `docs/PHASE2_DECIMAL_MIGRATION_AUDIT.md` and `docs/PHASE3_TYPE_SAFETY_AUDIT.md`.

## Decimal Migration (Phase 2)
- Float hotspots (from `rg "parseFloat|toFixed|Math\.round" src`): **158 files**.
- Money helpers that already use Decimal: `src/utils/decimal-converters.ts`, `src/utils/calculations-decimal.ts`, `src/types/decimal-types.ts`.
- Candidate shared utilities to build before the sweep:
  - A `Money` value object with formatting + arithmetic.
  - Conversion helpers (DB string ↔ Decimal ↔ display).
  - Test matrix covering deposits/withdrawals, rounding, multi-currency.
- Compliance hooks to keep in mind: audit trail logging (transactions, reconciliations) and change history.

## Type Safety Restoration (Phase 3)
- `rg "as any" src` currently reports **245 usages across 116 files**.
- Primary clusters: Redux slices (`serializeForRedux` return types), analytics services, parser utilities, legacy React components.
- Recommended approach:
  1. Catalogue aliases/types that already exist (`RootState`, `Transaction`, `Account` etc.).
  2. Introduce targeted helper types (e.g. `Serialized<T>` wrappers) to replace repeated casts.
  3. Update test factories to emit fully typed entities so `as any` is unnecessary.
- Supporting docs to update during the sweep: `CLAUDE.md` §6 and `docs/PHASE3_TYPE_SAFETY_AUDIT.md`.

## Tools & Scripts
- `rg` commands for quick reference:
  - Floats: `rg "parseFloat|toFixed|Math\\.round" src`
  - Type bypasses: `rg "as any" src`
- Consider adding helper npm scripts during Phase 2/3 (e.g. `npm run lint:floats`, `npm run lint:any`).

This file is intentionally lightweight; keep it updated as the inventories shrink so we can measure progress at the start of each phase.
