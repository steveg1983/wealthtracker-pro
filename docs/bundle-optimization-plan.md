# Bundle Optimisation Plan – 2025-10-29

We captured Vercel build logs for deployment `wealthtracker-l514dsq11` (see `logs/deployments/20251029_2133_wealthtracker-web.log`). The largest emitted bundles are:

- `chunk-tBQuDGzl.js` – **4.6 MB** (gzip 1.37 MB): ships `react-plotly.js` + Plotly core.
- `index-a-UlsUyK.js` – **1.1 MB** (gzip 311 KB): main vendor chunk with Redux + Supabase surface + data tooling.
- `chunk-D8XJBbX3.js` – **0.58 MB** (gzip 167 KB): d3 utilities + chart helpers.
- `xlsx-Bx0RsK1h.js` – **0.49 MB** (gzip 159 KB): SheetJS export stack.
- `chunk-BKLdmH-G.js` – **0.43 MB** (gzip 114 KB): aggregation helpers (likely date-fns + analytics pipelines).

## Immediate Targets

1. **Plotly (Analytics / Chart Wizard)**
   - `src/components/analytics/ChartWizard.tsx` lazy-loads `react-plotly.js`, but the chunk still embeds full Plotly.
   - Action:
     - Switch to `react-plotly.js/factory` with `plotly.js-dist-min` loaded via `import('plotly.js-dist-min')`.
     - Evaluate using the `plotly.js-basic-dist` bundle (~1.3 MB) + feature-by-feature augmentations to shrink footprint.
     - Gate heavy chart types (Sankey, Treemap, Funnel) behind dynamic `import()` so the default analytics dashboard only loads basic traces.
     - Ensure `ChartWizard` and any saved chart renderers share a deferred loader (e.g., `importPlotly()` helper with caching).

2. **Export Stack (Data Management / EnhancedExportManager)**
   - `src/components/EnhancedExportManager.tsx` statically imports `jspdf`, `jspdf-autotable`, and `xlsx`.
   - Actions:
     - Refactor to use existing async helpers in `src/utils/dynamic-imports.ts` (`importPDFLibraries`, `importXLSX`) so these packages load on first export interaction.
     - Audit other export entry points (`services/exportService.ts`, `EnhancedExportModal.tsx`) to ensure they reuse the loaders and don’t re-introduce eager imports.
     - Add loading states/spinners for PDF/XLSX actions to cover the async import delay.

3. **Data Management Route (`/settings/data-management`)**
   - Lazily renders numerous import/export modals; confirm each modal defers heavy tooling:
     - `CSVImportWizard`, `BatchImportModal`, `ImportDataModal`, `OFXImportModal`, `QIFImportModal`.
   - Action:
     - Double-check these components rely on the dynamic import helpers (e.g., `enhancedCsvImportService` should not eagerly load parsing libs).
     - Split the manager shell (`EnhancedExportManager`, rules UI, batch import tools) so modal code paths only load after corresponding buttons are clicked.

4. **Analytics Supporting Libraries**
   - Chunks `chunk-D8XJBbX3.js` / `chunk-BKLdmH-G.js` include d3-like helpers and analytics engines.
   - Actions:
     - Trace imports for `analyticsEngine`, `dataVisualizationService`, and custom chart helpers to identify static references.
     - Consider splitting advanced analytics (forecasting, anomaly detection) into on-demand modules triggered from the respective tabs.

## Tooling & Follow-Up

- Integrate `rollup-plugin-visualizer` or `vite-bundle-visualizer` in a local-only script (`npm run bundle:report`) to track changes.
- Add CI guardrail: persist `dist/stats/bundle-report.html` artefact for manual review when bundle thresholds are exceeded.
- Document the new lazy-loading patterns in `docs/performance.md` (to be created) and update component guidelines so new features keep exports & heavy charts deferred.
- After converting the top offenders, re-run Vercel build and capture updated chunk sizes for comparison.
