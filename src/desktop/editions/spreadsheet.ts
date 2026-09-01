/**
 * `@spreadsheet`, on a device: one absence, by decision, with a number behind it.
 *
 * The device half of the seam `editions/spreadsheet.ts` declares, and the twin
 * of `editions/cloud/spreadsheet.ts`. This edition writes CSV and PDF and does
 * not write .xlsx.
 *
 * ── THE RULING, AND WHAT IT BOUGHT ──────────────────────────────────────────
 *
 * The owner, 1 September 2026: *"Lose excel is fine as long as they can keep
 * csv."* Measured on the renderer of the day, `xlsx-*.js` was 488.0 KiB raw and
 * 159.2 KiB gzipped — the largest chunk in the bundle, 124 KiB clear of the
 * next one, and 11% of everything the binary embeds. A desktop build has no
 * lazy chunks in the sense a browser does: `tauri.conf.json` names
 * `apps/desktop/dist` as `frontendDist` and `generate_context!` embeds all of it
 * at compile time, so a chunk nobody loads is still bytes on the disk of
 * somebody who bought the program once.
 *
 * ── WHY NOTHING HERE IS DISABLED ────────────────────────────────────────────
 *
 * `CAN_EXPORT_SPREADSHEETS` is false and every Excel control on the Export
 * surfaces is therefore NOT PRINTED — not greyed, not present-and-apologetic.
 * That is the bank-feeds lesson (owner, 26 Aug, from the first real install):
 * a control whose action cannot exist in this edition is a menu item to leave
 * out, because a dead control makes a person wonder what they did wrong.
 *
 * What replaces it is a sentence rather than a gap. CSV is offered as *"opens in
 * Excel"*, which is true — every spreadsheet on earth reads one — so the person
 * who came for a spreadsheet still leaves with one.
 */

import type {
  SpreadsheetExportDialog,
  SpreadsheetSupport,
  WriteSpreadsheet
} from '../../editions/spreadsheet';

// The same list the cloud half re-exports, for the same reason: a specifier is
// only a substitution if both sides answer for the same vocabulary.
export type {
  SpreadsheetCell,
  SpreadsheetExportDialog,
  SpreadsheetExportProps,
  SpreadsheetSheet,
  SpreadsheetSupport,
  SpreadsheetWorkbook,
  WriteSpreadsheet
} from '../../editions/spreadsheet';

/** No spreadsheet writer in this bundle, so no control that would need one. */
export const CAN_EXPORT_SPREADSHEETS: SpreadsheetSupport = false;

/**
 * No Excel modal.
 *
 * A component that renders nothing rather than a missing export, for
 * `desktop/editions/chrome.tsx`'s reason: the caller renders it inside a
 * `<Suspense>` and holds it in a variable, and a half that simply omitted the
 * name would fail the web build's shape rather than this one's.
 */
export const SpreadsheetExport: SpreadsheetExportDialog = () => null;

/**
 * Nothing calls this, and if anything ever does it says so out loud.
 *
 * The fact above is false in this edition, so no control that could reach this
 * is drawn — which makes a call here a wiring mistake rather than a user
 * action. R-8's ruling, one layer up: refusing beats succeeding at nothing,
 * because a download button that produces no file and reports success is the
 * failure this whole seam exists to prevent.
 *
 * THE SENTENCE DELIBERATELY DOES NOT SPELL THE EXTENSION, and that is not
 * fussiness — the first draft did, and `scripts/desktop-bundle-greps.mjs` failed
 * the build on it, naming `ExportManager`'s chunk. The grep is a plain
 * case-insensitive word and it is right to be: a bundle that spells the four
 * letters is a bundle somebody has to go and read. A refusal is not worth
 * blunting an instrument for.
 */
export const writeSpreadsheet: WriteSpreadsheet = () =>
  Promise.reject(
    new Error(
      'This edition writes CSV and PDF, not Excel workbooks. Nothing should have offered one: '
        + 'CAN_EXPORT_SPREADSHEETS is false here.'
    )
  );
