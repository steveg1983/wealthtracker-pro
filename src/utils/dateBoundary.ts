/**
 * Where a date STOPS being wire text and becomes a real Date.
 *
 * WHY this exists: `Transaction.date` is typed `Date`, but nothing made that
 * true. Postgres hands the `date` column over as "2026-08-01", and every
 * JSON-backed store (localStorage collections, an exported backup) re-hydrates
 * it as a string too. TypeScript cannot see the difference, and JavaScript does
 * not complain either — it just answers wrongly:
 *
 *     "2026-08-15" >= new Date('2026-08-01')   // false. ALWAYS false.
 *
 * A string compared against a Date is coerced to a number (NaN), so EVERY
 * relational comparison is false. That silently reported £0 spent on every
 * budget, never fired a spending alert, and dropped every row from the
 * category-spending helpers and the PDF export's period filter.
 *
 * The fix is not a defensive `new Date(t.date)` at each of the ~50 call sites
 * (which is how the bug survived: the defensive sites hid it from the ones that
 * were not). It is to convert ONCE, at every boundary where rows enter app
 * state, so the declared type is the truth from there on.
 *
 * Parsing rule: `new Date(value)` semantics, unchanged — a date-only string is
 * read as UTC midnight, exactly as the display and comparison call sites that
 * already wrapped their reads have always read it. Nothing shifts.
 *
 * Unusable values become an INVALID Date rather than the epoch: a transaction
 * that quietly files itself in 1970 is worse than one that fails every date
 * filter, which is what a garbage string did before this module existed.
 */

import type { Transaction } from '../types';

/**
 * A Date — including one built in ANOTHER realm.
 *
 * `instanceof` compares prototypes, so a Date that crossed a realm boundary
 * (a structured clone out of IndexedDB, a worker message, an iframe, jsdom vs
 * Node under test) fails it while being a perfectly good Date. Treating one as
 * unparseable would replace a real date with an Invalid Date — the boundary
 * would be corrupting exactly the data it exists to protect. The brand check
 * below reads the internal date slot and is realm-independent.
 */
function isDateLike(value: unknown): value is Date {
  return value instanceof Date || Object.prototype.toString.call(value) === '[object Date]';
}

/**
 * A date as milliseconds since the epoch, in whichever shape it arrived —
 * a Date, the wire's "2026-08-01"/ISO string, or an epoch number. NaN when the
 * value cannot be read as a date (and NaN compares false against everything,
 * so a bad date filters OUT rather than landing in an arbitrary period).
 */
export function toDateMs(value: unknown): number {
  if (isDateLike(value)) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'string') return Date.parse(value);
  return Number.NaN;
}

/**
 * The same value as a Date of THIS realm. A local Date is returned untouched
 * (no clone: the callers below own these rows, and the boot path maps 50k+ of
 * them); a foreign one is rebuilt at the same instant so `instanceof Date`
 * holds everywhere downstream.
 */
export function toDateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(toDateMs(value));
}

/**
 * Force a real Date onto every row's `date`, in place, and hand the same array
 * back.
 *
 * IN PLACE deliberately: every caller has just parsed or mapped these rows
 * (a PostgREST response, a structured clone out of IndexedDB, a JSON blob) and
 * nothing else holds a reference yet, so there is nothing to surprise — while
 * copying 50k objects on the boot path is not free. Rows whose date is already
 * a Date cost one `instanceof` and are left alone.
 */
export function normalizeTransactionDates(rows: Transaction[]): Transaction[] {
  for (const row of rows) {
    const raw: unknown = row.date;
    if (raw instanceof Date) continue;
    row.date = toDateValue(raw);
  }
  return rows;
}
