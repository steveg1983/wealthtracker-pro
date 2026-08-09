/**
 * Does a date FIT in the register's Date column? The arithmetic, in one place.
 *
 * ─ WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The column shipped at 100px and cut the last digit off the year — "28/08/202"
 * — which is the worst possible way for a register to be wrong, because it is
 * still perfectly readable and simply says the wrong thing. The fix is not a
 * nudge: it is knowing how wide the text actually is, and keeping every inset
 * between the column edge and the text written down where a change to one of
 * them can be checked against it.
 *
 * The terms live in three different files (the column width in
 * AccountTransactions, the cell padding in VirtualizedTable, the field's own
 * padding in QuickEditRow and DatePicker), so none of them can see the sum. The
 * sum is here, and the test beside it reads the real class names back off the
 * rendered DOM — so moving any inset breaks a test rather than a year.
 *
 * ─ WHERE THE TEXT WIDTHS COME FROM ─────────────────────────────────────────
 * Measured from Inter's own hmtx table (the register's font — index.html loads
 * it, tailwind.config sets it) at 14px, the size `text-sm` resolves to. Inter's
 * default figures are PROPORTIONAL, not tabular: '1' is 5.69px and '4' is
 * 9.04px, so "11/11/2011" and "04/04/2044" are 26px apart and sizing to a
 * typical date guarantees an atypical one is clipped.
 *
 *   Inter 400, 14px   widest real date 1900–2099  "04/04/2044"  81.30px
 *                     all-eight-widest-digits bound              82.44px
 *                     the placeholder "dd/mm/yyyy"               83.23px  ← max
 *   Inter 600, 14px   widest real date 1900–2099  "04/04/2044"  84.34px  ← max
 *
 * Two numbers because the two states are set in different weights: the field is
 * `font-normal` (400) whatever the row around it is, while the read-only cell
 * of the HIGHLIGHTED row inherits that row's `font-weight: 600` from
 * .selected-transaction-row.
 *
 * Both rounded UP to whole pixels below. The register table is `lg:` and up
 * only, so the mobile `input { font-size: 1rem }` rule never reaches it.
 */

/**
 * The widest string the editing field ever has to draw, in px — Inter 400 at
 * 14px, rounded up. It is the PLACEHOLDER, not a date: "dd/mm/yyyy" is wider
 * than every real date, and a field whose empty state is clipped looks broken
 * before the user has typed anything.
 */
export const DATE_FIELD_TEXT_PX = 84;

/**
 * The widest date the read-only cell ever has to draw, in px — Inter 600 at
 * 14px, rounded up, because the highlighted row is bold.
 */
export const DATE_CELL_TEXT_PX = 85;

/**
 * How much room to leave beyond the text itself.
 *
 * Not decoration. It covers the caret at the end of a full date, sub-pixel
 * rounding on a non-integer device pixel ratio, and the day someone's browser
 * falls back from Inter to a slightly wider system font because Google Fonts
 * was slow. Eight pixels is about one digit — the unit in which this goes
 * wrong.
 */
export const DATE_TEXT_COMFORT_PX = 8;

/**
 * The Date column's default width, in px.
 *
 * Was 100, which left the field 78px of text for the 84 it needs. 120 leaves
 * 98px for the field and 96px for the read-only cell — a comfortable digit and
 * a half beyond the worst case in both states, and it costs nothing but 20px of
 * the Description column, which is the flex filler and absorbs it.
 *
 * A width the user has dragged for themselves is theirs and is not touched;
 * this is only where the column starts.
 */
export const DATE_COLUMN_WIDTH_PX = 120;

/**
 * The padding every table cell carries — `px-3` on each side, from
 * VirtualizedTable's cell. Box-sizing is border-box throughout (Tailwind
 * preflight), so this comes straight off the column's width.
 */
export const TABLE_CELL_INSET_PX = 24;

/**
 * What the editing field's own wrapper keeps — `px-1` each side, from the Date
 * cell's QuickEditCellShell.
 *
 * The shell's `-mx-3` cancels the cell padding above entirely and puts this back
 * instead, which is why TABLE_CELL_INSET_PX does NOT appear in the field's
 * budget: the two are alternatives, not a stack.
 */
export const DATE_FIELD_SHELL_INSET_PX = 8;

/**
 * What the date input itself keeps — `px-1.5` each side (DatePicker's `sm`
 * `plain` chrome, chosen because `showIcon={false}` gives back the 32px the
 * calendar glyph would have reserved) plus its 1px border on each side.
 */
export const DATE_INPUT_INSET_PX = 14;

/** How many px of text the editing field gets, in a column this wide. */
export function dateFieldTextBudgetPx(columnWidthPx: number): number {
  return columnWidthPx - DATE_FIELD_SHELL_INSET_PX - DATE_INPUT_INSET_PX;
}

/** How many px of text the read-only cell gets, in a column this wide. */
export function dateCellTextBudgetPx(columnWidthPx: number): number {
  return columnWidthPx - TABLE_CELL_INSET_PX;
}

/**
 * The narrowest the Date column can be before a date is cut — the answer the
 * default is chosen to clear, and the number to check a new default against.
 */
export function minimumDateColumnWidthPx(): number {
  return Math.max(
    DATE_FIELD_TEXT_PX + DATE_TEXT_COMFORT_PX + DATE_FIELD_SHELL_INSET_PX + DATE_INPUT_INSET_PX,
    DATE_CELL_TEXT_PX + DATE_TEXT_COMFORT_PX + TABLE_CELL_INSET_PX
  );
}
