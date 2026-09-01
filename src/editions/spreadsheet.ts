/**
 * WHETHER THIS EDITION WRITES .xlsx — the contract, named by neither edition.
 *
 * The owner's ruling, 1 September 2026: *"Lose excel is fine as long as they can
 * keep csv."* The desktop edition's Export surfaces therefore offer CSV and PDF
 * and no spreadsheet at all, and the web edition is untouched — same button,
 * same modal, same chunk, same bytes.
 *
 * ── WHY THIS IS A SEAM AND NOT AN `if` ──────────────────────────────────────
 *
 * A runtime check would have removed the BUTTON and kept the LIBRARY. Vite
 * splits `await import('xlsx')` into a chunk whatever surrounds it, and
 * `tauri::generate_context!` embeds every file in `apps/desktop/dist` into the
 * binary at compile time — so a lazily-loaded chunk is not deferred on a
 * desktop, it is simply 488 KiB of SheetJS on the buyer's disk and in the
 * WebView's parse. It was the largest chunk in the renderer by 124 KiB, for one
 * button.
 *
 * Moving the choice in front of the bundler is the whole fix, and it is the
 * argument `docs/edition-gating.md` makes for all eight of these. The desktop
 * build resolves `@spreadsheet` to a half that imports no spreadsheet writer, so
 * the writer is not reachable, so it is not built.
 *
 * ── ONE FACT, ONE DIALOG, ONE WRITER, AND WHY THAT IS THE WHOLE SURFACE ─────
 *
 * There were exactly two consumers of `xlsx`, and they need different things:
 *
 *   `components/ExcelExport.tsx`         a modal that is ENTIRELY about Excel —
 *                                        five sheets, column widths,
 *                                        autofilters. Nothing in it survives
 *                                        the format's removal, so the whole
 *                                        component comes through the seam and
 *                                        the device half draws nothing.
 *   `components/EnhancedExportManager`   a report builder that also writes PDF
 *                                        and CSV, both of which a device keeps.
 *                                        Only the one branch is the seam's, so
 *                                        it hands over SHEETS — plain rows of
 *                                        strings and numbers — and the seam
 *                                        turns them into a file.
 *
 * {@link SpreadsheetSupport} is the third member and the reason the other two
 * cannot disagree with the bundle: the same import that decides what is BUILT
 * decides what is DRAWN. A build with no writer in it cannot draw a button
 * offering one, and a build that draws the button has the writer behind it.
 *
 * ── THE WRITER IS GIVEN A STEM, NOT A FILENAME ──────────────────────────────
 *
 * Deliberate, and measured rather than tidy-minded. A caller that appended
 * `.xlsx` itself would leave the string `".xlsx"` in a shared component, in the
 * desktop bundle, where `scripts/desktop-bundle-greps.mjs` would find it and be
 * right to: the extension is the FORMAT's business, and the format is what this
 * seam is about. The caller names the report; the writer names the file.
 */

import type { ComponentType } from 'react';

/**
 * WHETHER THIS EDITION CAN WRITE A SPREADSHEET AT ALL — a fact, not furniture.
 *
 * The same shape, and for the same reason, as `ChromeHasBankFeeds`: callers are
 * not mounting a thing, they are deciding whether to draw their OWN things — a
 * button, a format tile, a line of copy. A control whose action cannot exist in
 * this edition is not stubbed, it is NOT PRINTED (the bank-feeds lesson, owner,
 * 26 Aug). Disabling it would be worse than absent: a dead control asks the
 * person to work out what they did wrong.
 */
export type SpreadsheetSupport = boolean;

/** What the dedicated Excel exporter is told. */
export interface SpreadsheetExportProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The dedicated Excel exporter, as a modal.
 *
 * Typed as a plain component even though the web's is `React.lazy`, exactly as
 * `ChromeQuickAddTransaction` is and for the same reason: the caller renders it
 * inside a `<Suspense>` either way, and an edition whose answer is *nothing*
 * should not have to pretend to be worth a chunk.
 */
export type SpreadsheetExportDialog = ComponentType<SpreadsheetExportProps>;

/**
 * One cell.
 *
 * Numbers stay numbers — a spreadsheet's whole point is that a reader can sum
 * the Amount column, and a money figure that arrived as text cannot be summed.
 * Every number handed over here has already been through `toDecimal` at its
 * call site; `.toNumber()` at the boundary is the same rounding the CSV and PDF
 * writers do, one step before the file.
 */
export type SpreadsheetCell = string | number;

/** One sheet: its tab name, and its rows including the header row. */
export interface SpreadsheetSheet {
  readonly name: string;
  readonly rows: SpreadsheetCell[][];
}

/**
 * A whole workbook, waiting for an edition that can write one.
 *
 * `stem` is the file's name WITHOUT an extension — see the header. Sheets are
 * written in the order given, which is the order the tabs appear in.
 */
export interface SpreadsheetWorkbook {
  readonly stem: string;
  readonly sheets: readonly SpreadsheetSheet[];
}

/**
 * Write the workbook to the user's disk, or refuse in words.
 *
 * The device half refuses rather than resolving quietly, for R-8's reason one
 * layer up: a writer that succeeded at doing nothing would be a download button
 * that produces no file and says nothing. Nothing calls it — the fact above is
 * false in that edition, so no control that could reach it is drawn — and the
 * refusal is what makes that a bug rather than a silence if it ever stops being
 * true.
 */
export type WriteSpreadsheet = (workbook: SpreadsheetWorkbook) => Promise<void>;
