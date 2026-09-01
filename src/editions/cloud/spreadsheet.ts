/**
 * `@spreadsheet`, in a browser: Excel, exactly as it has always been.
 *
 * The cloud half of the seam `editions/spreadsheet.ts` declares, and the twin of
 * `desktop/editions/spreadsheet.ts`. Three members: a fact, a lazy import moved
 * here whole, and the eight lines of SheetJS that used to sit inside
 * `EnhancedExportManager`.
 *
 * ── NOTHING ABOUT THE WEB EDITION CHANGED, AND THAT IS THE POINT ────────────
 *
 * `lazyWithRecovery(() => import('../../components/ExcelExport'))` was one line
 * at the top of `pages/ExportManager.tsx` and it moved here unaltered, chunk and
 * all — the same move, for the same reason, that `AddTransactionModal` made into
 * `editions/cloud/chrome.tsx`: a dynamic import is an import, and leaving it in
 * a shared page would leave `xlsx` reachable from the desktop graph in the one
 * way that looks like it is not there.
 *
 * The writer below is likewise the code that was in `generateExcel`, with the
 * report's own arithmetic left behind in the component where it belongs. A
 * browser gets the same workbook, the same sheet order, the same filename.
 */

import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import type {
  SpreadsheetExportDialog,
  SpreadsheetSupport,
  WriteSpreadsheet
} from '../spreadsheet';

// ONE SPECIFIER, VALUES AND TYPES TOGETHER — the rule `services/port/index.ts`
// states for `@data`. A component that had to import the surface from one door
// and the shape of the rows it hands that surface from another would be a
// component that knows there are two editions.
export type {
  SpreadsheetCell,
  SpreadsheetExportDialog,
  SpreadsheetExportProps,
  SpreadsheetSheet,
  SpreadsheetSupport,
  SpreadsheetWorkbook,
  WriteSpreadsheet
} from '../spreadsheet';

/** A browser can write .xlsx, so every Excel control on the Export page is drawn. */
export const CAN_EXPORT_SPREADSHEETS: SpreadsheetSupport = true;

/**
 * The dedicated Excel exporter — five sheets, column widths, autofilters.
 *
 * Lazy, as it was on the page it moved off: mounting it is what fetches both
 * this modal and the 488 KiB spreadsheet writer behind it, and neither is worth
 * a byte until somebody presses the button.
 */
export const SpreadsheetExport: SpreadsheetExportDialog = lazyWithRecovery(
  () => import('../../components/ExcelExport')
);

/**
 * Rows in, .xlsx out.
 *
 * `writeFile` rather than a Blob and an anchor because that is what the code
 * this replaced did, and because SheetJS's own writer is what knows how to name
 * a sheet, escape a cell and pick a codepage. The extension is appended HERE —
 * see the contract's last paragraph, which is a bundle-grep argument rather than
 * a stylistic one.
 */
export const writeSpreadsheet: WriteSpreadsheet = async ({ stem, sheets }) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  XLSX.writeFile(workbook, `${stem}.xlsx`);
};
