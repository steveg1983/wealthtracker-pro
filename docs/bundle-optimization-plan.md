# Bundle Optimisation Plan

**Rewritten 2026-08-12.** The original 2025-10-29 plan described a build that no
longer exists — its top offender (a 4.6 MB Plotly chunk) has since been deleted
from the product entirely, and every one of its "immediate targets" was found
already implemented when the plan was picked back up. This file now records
what is TRUE, so the next optimisation pass starts from measurement rather than
archaeology. All sizes measured in one directory on one machine (chunk hashes
change with absolute paths); the gate is `npm run bundle:check` (gzip -9).

## Current state (2026-08-12)

Entry chunk **1,102.68 kB raw / 311.4 KB gz** against a 320 KB budget — green
with 8.6 KB headroom. JS total 1,387.4 KB gz against 1,500 KB.

## Done (verified, not planned)

- **Plotly: deleted from the product.** Zero occurrences in `src/`. The chunk
  the 2025 plan was written around is gone.
- **Charting: one library.** recharts only (16 importers);
  chart.js/react-chartjs-2 are out of `package.json` entirely. See
  `src/components/charts/DashboardCharts.tsx` for the migration note.
- **Export stack: lazy.** `xlsx` (162.9 KB gz), `jspdf` (118.9 KB gz),
  `html2canvas` (47.4 KB gz), `jspdf-autotable` (9.7 KB gz) all arrive via
  dynamic `import()` at the call sites and ship as their own chunks, loaded on
  first export/import interaction.
- **crypto-js: narrowed (2026-08-12, the change that turned the gate green).**
  `import CryptoJS from 'crypto-js'` pulls every cipher the library ships;
  242 KB sat in the entry chunk (eager — `encryptedStorageService` runs at
  boot) and ~140 KB of it was algorithms no line of code calls.
  `src/security/cryptoSuite.ts` now imports core + the five algorithms in use,
  with a load-time guard against tree-shaking regressions and byte-for-byte
  compatibility tests (`src/security/__tests__/cryptoSuite.test.ts`) proving
  old ciphertext still decrypts. Adding an algorithm means adding its import
  THERE — reaching for the `crypto-js` index again restores all 242 KB.

## What remains in the entry chunk (structural — needs design, not tweaks)

| Weight | What | Why it is hard |
|---|---|---|
| ~385 KB raw | `@supabase/*` | monolithic `createClient`; splitting it is an architecture decision |
| ~132 KB raw | `react-dom` | the framework |
| ~125 KB raw | `decimal.js` | the money core; non-negotiable at boot |
| ~114 KB raw | `dompurify` | eager via GlobalSearch in the header |
| ~117 KB raw | `services/dataService.ts` | the app's own data layer |

Known-but-parked items:

- `src/security/index.ts` re-exports (`export *`) defeat that file's own
  dynamic imports — real defect, but worth only ~3 KB gz while `dompurify`
  stays eager anyway. Separate ticket.
- `EnhancedConflictResolutionModal` (16 KB) sits in the eager chunk via
  `Layout.tsx` — but `Layout` is desktop-reachable, so lazy-loading it moves
  the desktop renderer's size ratchet. Do it, if ever, as a deliberate desktop
  change, not a web tweak.

## Discipline

- The gate (`npm run bundle:check`) runs in CI on every PR; headroom is thin
  (8.6 KB), so treat any entry-chunk growth as a review question.
- New heavy libraries: dynamic `import()` at the call site, `import type` for
  types, loading states on the async path, and an error surfaced to the user
  if the import fails — a silent no-op export button is not acceptable in a
  finance app.
