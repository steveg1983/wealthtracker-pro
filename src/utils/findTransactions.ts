/**
 * FIND — "where is that transaction?", asked of every account at once.
 *
 * ─ WHAT THIS IS AND IS NOT ─────────────────────────────────────────────────
 * Microsoft Money had no global ledger. It had Find: you typed, it listed what
 * matched, and clicking a line took you to that row IN ITS OWN REGISTER, which
 * is where the work happens. This module is the matching half of that — a pure
 * pass over the rows already in memory, producing a capped, ordered list of
 * MATCHES. It edits nothing, and it deliberately offers no paging: a search
 * that returns four thousand rows is a search that needs narrowing, not a
 * treadmill (see FIND_RESULT_CAP).
 *
 * ─ WHAT IT SEARCHES, AND WHY ONLY THAT ─────────────────────────────────────
 * The description and the amount. Those are the two things a person actually
 * remembers about a transaction they are hunting for — "the ironmongers", "the
 * one for a hundred and forty-one fifty" — and keeping the field list short is
 * what makes an empty result trustworthy: the view can state exactly what was
 * searched, so "no matches" means something. Category, tags and notes belong to
 * the register's own filter, where the user has already narrowed to one account
 * and is looking at those columns.
 *
 * ─ THE AMOUNT RULE (two halves, both needed) ───────────────────────────────
 * 1. SUBSTRING, exactly as the account register's search does it
 *    (`t.amount.toString().includes(term)`, AccountTransactions). Typing "141"
 *    finds 141.50 and 1418.00 here just as it does there — one habit, two
 *    surfaces.
 * 2. EXACT MAGNITUDE, which the substring alone cannot do. `(-141.5).toString()`
 *    is "-141.5", so a user typing the amount the way their statement prints it
 *    — "141.50" — matches nothing under rule 1. So a query that reads as a
 *    money amount is also compared numerically against |amount|: ±141.50 both
 *    match, because "which side of the ledger was it on" is the thing the user
 *    is trying to find out, not something they already know.
 *
 * The numeric comparison goes through Decimal, never a float ===: 0.1 + 0.2 is
 * the reason, and this file is under the money rules like every other.
 *
 * ─ COST ────────────────────────────────────────────────────────────────────
 * One linear pass over the in-memory transactions (O(n), n = every row the user
 * owns), then a sort of the MATCHES (O(m log m), m = matches), then a slice to
 * the cap. The rendering surface therefore never draws more than the cap,
 * however large n is — which is the whole reason Find can exist over a
 * fifty-thousand row history when a global register could not.
 */

import type { Transaction } from '../types';
import { toDecimal, type DecimalInstance } from './decimal';
import { toDateMs } from './dateBoundary';
import { compareChronological } from './transactionSort';

/**
 * How many matches Find will draw.
 *
 * Money's own Find window showed a scrolling list, but Money was not rendering
 * into a browser and its ledgers were not fifty thousand rows. The cap is the
 * honest version of the same promise: the top of the answer, immediately, with
 * the size of the full answer stated so the user knows to narrow rather than
 * scroll. 200 is comfortably more than anyone reads and comfortably less than
 * anything a browser struggles with.
 */
export const FIND_RESULT_CAP = 200;

/** What the user asked for. Every field optional-by-emptiness. */
export interface FindCriteria {
  /** The typed text. Trimmed by the matcher; empty means "no text condition". */
  text: string;
  /** Inclusive start of a day range, `YYYY-MM-DD`, or undefined for no floor. */
  dateFrom?: string;
  /** Inclusive end of a day range, `YYYY-MM-DD`, or undefined for no ceiling. */
  dateTo?: string;
}

export interface FindOutcome {
  /** The rows to draw: newest first, never more than `cap` of them. */
  rows: Transaction[];
  /** How many matched in total — the figure the "narrow the search" line needs. */
  total: number;
  /** True when `total` exceeded the cap and `rows` is only the head of it. */
  capped: boolean;
}

/**
 * The inclusive day window as epoch milliseconds, or null bounds where the
 * caller gave none.
 *
 * Read in UTC because a date-only value is: `new Date('2026-04-01')` is UTC
 * midnight (see utils/dateBoundary), and that is what the wire hands over for
 * every `date` column. The ceiling is the last millisecond of the named day, so
 * a row carrying a real timestamp on that day is inside the range — the account
 * register's own filter compares against midnight and drops those, which is a
 * bug this must not copy into the one view whose job is finding things.
 *
 * An unparseable bound is ignored rather than obeyed: a mistyped URL parameter
 * must not silently empty the results of a search that also has text.
 */
function dayWindow(criteria: FindCriteria): { from: number | null; to: number | null } {
  const parse = (day: string | undefined, endOfDay: boolean): number | null => {
    if (!day) return null;
    const ms = Date.parse(`${day}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isFinite(ms) ? ms : null;
  };
  return { from: parse(criteria.dateFrom, false), to: parse(criteria.dateTo, true) };
}

/**
 * Has the user actually asked an answerable question?
 *
 * A Find with no text and no dates is not "everything" — it is a question that
 * has not been typed yet, and answering it with the first 200 rows of the whole
 * ledger would rebuild the very page this replaced.
 *
 * A date range that cannot be READ counts as no range for the same reason: one
 * malformed URL parameter (a stale push notification, a hand-edited link) must
 * not be able to conjure that page back by accident. Declared here rather than
 * in the view so the list and the words above it can never disagree about
 * whether anything was asked.
 */
export function isFindCriteriaEmpty(criteria: FindCriteria): boolean {
  if (criteria.text.trim() !== '') return false;
  const { from, to } = dayWindow(criteria);
  return from === null && to === null;
}

/**
 * The typed text read as a money amount — magnitude only — or null when it is
 * not one.
 *
 * Currency symbols, thousands separators and spaces are stripped first, because
 * "£1,250" is how a person copies an amount off a statement. A leading minus is
 * accepted and then discarded: see rule 2 above, Find matches the size.
 */
export function parseAmountQuery(text: string): DecimalInstance | null {
  const cleaned = text.trim().replace(/[£$€,\s]/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  return toDecimal(cleaned).abs();
}

/**
 * Does this row answer the typed text?
 *
 * Exported for the same reason the register's predicates are: one definition,
 * asked by the matcher and by any test that wants to state the rule directly.
 */
export function matchesFindText(transaction: Transaction, text: string): boolean {
  const term = text.trim();
  if (term === '') return true;

  const lowered = term.toLowerCase();
  if (transaction.description.toLowerCase().includes(lowered)) return true;

  // Rule 1: the register's substring, on the raw number.
  if (transaction.amount.toString().includes(lowered)) return true;

  // Rule 2: the amount as the statement prints it.
  const asAmount = parseAmountQuery(term);
  if (asAmount !== null && toDecimal(transaction.amount).abs().equals(asAmount)) return true;

  return false;
}

/**
 * Run the search.
 *
 * Archived rows are excluded: they are the rows the user has put away, and Find
 * is a way of getting AT the ledger you are working in. (The register keeps its
 * own "show archived" switch for the account you are actually in.)
 */
export function findTransactions(
  transactions: readonly Transaction[],
  criteria: FindCriteria,
  cap: number = FIND_RESULT_CAP
): FindOutcome {
  if (isFindCriteriaEmpty(criteria)) {
    return { rows: [], total: 0, capped: false };
  }

  const { from, to } = dayWindow(criteria);
  const matches: Transaction[] = [];

  for (const transaction of transactions) {
    if (transaction.archived) continue;

    if (from !== null || to !== null) {
      const when = toDateMs(transaction.date);
      // NaN fails both comparisons, so an unreadable date filters OUT of a
      // dated search rather than landing in an arbitrary window.
      if (from !== null && !(when >= from)) continue;
      if (to !== null && !(when <= to)) continue;
    }

    if (!matchesFindText(transaction, criteria.text)) continue;

    matches.push(transaction);
  }

  // Newest first — the register's own chronological order, negated, so a row
  // read here and the same row read in its register agree about what came
  // after what.
  matches.sort((a, b) => -compareChronological(a, b));

  return {
    rows: matches.length > cap ? matches.slice(0, cap) : matches,
    total: matches.length,
    capped: matches.length > cap,
  };
}
