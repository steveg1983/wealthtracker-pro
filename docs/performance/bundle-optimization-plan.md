# Bundle Optimization Plan (2025-09-29 20:40 UTC)

_Source_: `bundle-size-report.json` generated after `npm run build && npm run bundle:report`.

## Current Heavy Hitters
| Rank | Asset | Size |
| --- | --- | --- |
| 1 | `assets/vendor-plotly-ADh8pNe3.js` | 1.24 MB |
| 2 | `assets/vendor-export-7HC4GUjT.js` | 1.14 MB |
| 3 | `assets/vendor-shared-BMpPIotj.js` | 583.05 KB |
| 4 | `assets/index-i6epdJAw.js` | 557.64 KB |
| 5 | `assets/vendor-grid-C79cKHak.js` | 525.71 KB |
| 6 | `assets/vendor-charting-CqeGa5nc.js` | 461.36 KB |
| 7 | `assets/FinancialPlanning-CQPDPIMk.js` | 379.62 KB |
| 8 | `assets/Transactions-CAGjme-p.js` | 141.05 KB |
| 9 | `assets/vendor-react-core-D28Q2z0q.js` | 140.50 KB |
| 10 | `assets/DashboardV2-CN1X49Fd.js` | 117.72 KB |

`vendor-plotly` and `vendor-export` remain the dominant payloads (Plotly registry plus export tooling). The reshaped `vendor-shared` chunk now carries the core app scaffolding (redux hooks, sanitizers, dropzone helpers) and weighs **~0.58 MB / 0.20 MB gzip** after migrating Plotly's internal D3 stack and export-side codecs (`canvg`, `pako`, `fflate`, `fast-png`, `svg-pathdata`, `iobuffer`) into their respective lazy vendor bundles. `index-i6epdJAw.js` is the application shell before lazy routes hydrate.

## Guiding Principles (“Apple level”)

1. **Initial load < 300 KB gzip** – fast first paint over typical consumer networks.
2. **Route-level isolation** – expensive domains (analytics, financial planning, document export) must not penalise core dashboard traffic.
3. **Deterministic chunk naming** – align with lazy routes for cacheability and diagnostics.
4. **Third-party governance** – only load Plotly/Chart.js/XLSX when required, ideally via web workers or streaming.
5. **Post-build regression checks** – every optimisation includes bundle diff + Lighthouse run.

## Immediate Actions (Sprint‑Ready)
1. **Vendor chunk split** ✅ _2025-09-29 (waves 1–4)_
   - Manual chunk rules in `vite.config.ts` now cordon off heavy families: `vendor-plotly`, `vendor-charting`, `vendor-export`, `vendor-grid`, `vendor-analytics`, `vendor-realtime`, `vendor-react-core`, `vendor-date-fns`, `vendor-supabase`, `vendor-stripe`, `vendor-state`, plus the shared catch‑all.
   - Latest pass added fine-grained buckets for `vendor-react-router`, `vendor-react-grid-layout`, `vendor-virtualization`, `vendor-dnd`, `vendor-icons`, `vendor-floating-ui`, `vendor-auth` (Clerk), `vendor-sentry`, and `vendor-motion`. Moving Plotly's internal D3 packages and export codecs into their dedicated bundles drops the shared chunk from **~0.92 MB / 0.30 MB gzip** to **~0.58 MB / 0.20 MB gzip** (now dominated by `dompurify`, `react-dropzone`, `swr`, `crypto-js`).
   - ChartWizard hydrates Plotly via the bespoke `plotlyLight` registry (`react-plotly.js/factory`) keeping only required traces; vendor Plotly chunk now sits at **~1.24 MB / 0.42 MB gzip** after inheriting its D3 dependencies (still lazily loaded with analytics flows).
   - Ag-grid assets hydrate exclusively on the Analytics explorer tab; CSS is deferred until the user enters that tab.
   - ✅ `exportService` reuses `importXLSX` for workbook creation/download to avoid duplicate XLSX payloads.
   - Next actions:
     1. Investigate the residual `vendor-shared` payload (`dompurify`, `react-dropzone`, `swr`, `crypto-js`) and peel off any remaining route-specific helpers (e.g. dropzone/file-selector into a lazy upload chunk).
     2. Profile `vendor-export` (~0.35 MB gzip) for additional trimming—confirm `canvg`/`pako` usage and prune unused export pathways.
     3. Continue shaving the Plotly registry (`plotlyLight`)—drop unused polar/financial traces once dashboards confirm coverage to claw back part of the D3 migration cost.
     4. Verify `vendor-react-grid-layout` and `vendor-dnd` only hydrate on dashboards/drag contexts; gate preloads accordingly.

2. **Finance & planning route optimisation**
   - `FinancialPlanning` still ships the full calculation engine. Move tax/forecast calculators behind per-tab `import()` boundaries and preload on navigation.
   - Audit `AppContextSupabase` for services eagerly importing tax/timeseries utilities; wrap in lazy factories similar to the Supabase client.

3. **Document/export tooling**
   - `xlsx`, `html2canvas`, `jspdf` used only for export flows. Replace direct imports with dynamic `import()` inside handlers. Provide loading states to keep UI responsive.
   - Consider offloading exports to a web worker or serverless endpoint to avoid blocking the main thread.

4. **PostCSS warning** ✅ _2025-09-29_
   - Tailwind’s bundled PostCSS loader and Vite’s URL rewriter now inject deterministic `from` metadata (see `/patches`). Build logs are clean; re-run `patch-package` after dependency upgrades.

## Longer-Term Enhancements
- **Critical CSS & inline fonts**: adopt CSS code splitting + inline critical path for landing/login to improve first paint.
- **Internationalisation bundles**: if/when locales added, ensure per-locale chunking.
- **Lighthouse automation**: wire `npm run perf:test` into CI after major bundle changes.
- **Performance budget**: enforce gzip < 250 KB for core entry via `performance.budget.json` + CI gate.

## Verification Checklist
- `npm run build:check` (ensures strict + build).
- `npm run bundle:report` and archive diff under `docs/performance/reports/` per milestone.
- `npm run lighthouse` on desktop + mobile to confirm real-world impact.
- Update `CLAUDE.md` + `docs/recovery-status.md` with new stats after each optimisation.

Keep this document current after every bundle optimisation round.
