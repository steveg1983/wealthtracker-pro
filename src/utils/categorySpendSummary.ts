/**
 * WHAT EACH CATEGORY ACTUALLY COST, over a year — the evidence a budget is
 * set against.
 *
 * The owner's spec (29 Aug 2026): before asking someone for a budget figure,
 * show them what they really spent, per category, with the annual and the
 * monthly side by side; whichever they type, compute the other. This module
 * is the first half of that — the arithmetic, pure and tested, so the screen
 * above it only has to render and the numbers can be argued with directly.
 *
 * ── THE WINDOW, AND WHY THE DEFAULT IS WHOLE MONTHS ─────────────────────────
 * "Last 12 months" has two honest readings and the owner named both:
 *
 *   'full-months'  the twelve COMPLETE calendar months before this one — on
 *                  29 August, that is 1 Aug 2025 to 31 Jul 2026. The default,
 *                  and his own reading: a budget set against a part-finished
 *                  month is set against a month that has not happened yet, and
 *                  every category reads low by however much of August is left.
 *   'to-yesterday' the rolling year ending yesterday. Truer to "the last
 *                  twelve months" as a phrase, and the right answer for
 *                  somebody who wants the most recent evidence including the
 *                  month in progress.
 *
 * Yesterday rather than today in both: today is itself a part-day.
 *
 * ── WHAT COUNTS ────────────────────────────────────────────────────────────
 * SPENDING only, and spending is what `classifyFlow` calls an expense — so
 * transfers between your own accounts are out (moving money is not spending
 * it), income is out, and revaluations are out (a fund going up is not
 * earning and a fund going down is not spending). Splits are expanded first,
 * so a £180 supermarket shop split £120 groceries / £60 wine lands in two
 * categories rather than one.
 *
 * Refunds NET OFF within their category: a £40 return against a £200 coat
 * makes the year's Clothing £160, because that is what the year cost. A
 * category whose refunds exceed its spending nets to zero rather than going
 * negative — "you were paid to shop here" is never the answer, and a negative
 * budget suggestion is nonsense.
 *
 * UNFILED SPENDING IS COUNTED AND REPORTED SEPARATELY. Money that went out
 * under no category cannot be attributed to one, but pretending it does not
 * exist would make every figure here quietly low. The caller gets the total
 * so the screen can say so — the house rule about naming the consequence
 * rather than showing a number that is wrong in a way nobody can see.
 *
 * ── MONEY IS DECIMAL, ALWAYS ───────────────────────────────────────────────
 * Every total is a Decimal from first addition to last, and the monthly
 * figure is the annual divided by twelve at full precision — the caller
 * rounds for display. Twelve is exact here BY CONSTRUCTION: both windows are
 * exactly twelve months long, which is the other reason the window is defined
 * in whole months rather than in days.
 */

import { toDecimal, type DecimalInstance } from './decimal';
import { buildPlWindow } from './plWindow';
import { buildCategoryKindLookup, classifyFlow } from './incomeExpense';
import { expandSplitTransactions } from './transactionSplits';
import type { Category, Transaction, TransactionSplit } from '../types';

export type SpendWindowKind = 'full-months' | 'to-yesterday' | 'calendar-year' | 'tax-year';

export interface SpendWindow {
  kind: SpendWindowKind;
  /** Inclusive ISO dates — the range the figures were summed over. */
  from: string;
  to: string;
}

export interface CategorySpend {
  categoryId: string;
  /** What the window cost, positive. Refunds are netted; never below zero. */
  annual: DecimalInstance;
  /** The same year, per month. Exactly annual ÷ 12 — both windows are 12 months. */
  monthly: DecimalInstance;
  /** How many rows made it up — evidence the figure is not one freak charge. */
  rows: number;
}

export interface CategorySpendSummary {
  window: SpendWindow;
  /** Leaf category id → what it cost. Categories with no spending are ABSENT. */
  byCategory: Map<string, CategorySpend>;
  /**
   * Spending that went out under NO category, and so belongs to none of the
   * rows above. Reported so the screen can say the figures are that much
   * short rather than looking complete and being wrong.
   */
  unfiled: DecimalInstance;
  unfiledRows: number;
}

const ZERO = toDecimal(0);
const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The twelve months a summary covers, from a given "now".
 *
 * Both kinds are exactly twelve months long — see the note on `monthly`.
 */
export function spendWindow(kind: SpendWindowKind, now: Date): SpendWindow {
  if (kind === 'full-months') {
    // The last COMPLETE month is the one before this one; the window is that
    // month and the eleven before it.
    const end = new Date(now.getFullYear(), now.getMonth(), 0);        // last day of last month
    const start = new Date(end.getFullYear(), end.getMonth() - 11, 1); // first day, 11 months earlier
    return { kind, from: iso(start), to: iso(end) };
  }
  if (kind === 'calendar-year' || kind === 'tax-year') {
    // A budgeter who thinks in calendar or tax years measures against the
    // last COMPLETE one (owner, 1 Sep 2026: "Some people may want to work on
    // calendar years"). The boundary rules — which year counts as complete,
    // and 6 April to 5 April for HMRC — already live in `buildPlWindow`
    // under the owner's own 19 Aug completeness ruling; deriving them here a
    // second time is how two screens come to disagree about a year. The end
    // is exclusive there and inclusive here, so step back one day BY PARTS —
    // parsing 'YYYY-MM-DD' through `new Date(string)` reads it as UTC
    // midnight and shifts a summer date across the day line (the localDayKey
    // lesson). Both years are exactly twelve months, so `monthly` stays
    // annual ÷ 12 like every other window.
    const pl = buildPlWindow(kind, now);
    const [year, month1, day] = pl.endExclusive.split('-').map(Number);
    return { kind, from: pl.start, to: iso(new Date(year, month1 - 1, day - 1)) };
  }
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); // yesterday
  const start = new Date(end.getFullYear(), end.getMonth() - 12, end.getDate() + 1);
  return { kind, from: iso(start), to: iso(end) };
}

/**
 * What every category cost over the window — the table the budget screen is
 * built on, and the same classifier the reports use, so the two cannot
 * disagree about what counts as spending.
 */
export function summariseCategorySpend(
  transactions: Transaction[],
  splits: TransactionSplit[],
  categories: Category[],
  options: { kind?: SpendWindowKind; now?: Date } = {}
): CategorySpendSummary {
  const window = spendWindow(options.kind ?? 'full-months', options.now ?? new Date());
  const kinds = buildCategoryKindLookup(categories);

  const totals = new Map<string, { total: DecimalInstance; rows: number }>();
  let unfiled = ZERO;
  let unfiledRows = 0;

  for (const row of expandSplitTransactions(transactions, splits)) {
    // `new Date(...)` around a value the type already calls a Date is the
    // house pattern (utils/incomeExpense does the same): the field is a Date
    // in the type and sometimes an ISO string at runtime, and this reads both.
    // Compared as ISO strings, which for YYYY-MM-DD is chronological order.
    const day = iso(new Date(row.date));
    if (day < window.from || day > window.to) continue;

    const kind = classifyFlow(row, kinds);
    // Spending only. An 'uncategorized' row is spending we cannot attribute,
    // which is a different thing from spending that did not happen.
    if (kind === 'uncategorized') {
      // Only the money going OUT: an unfiled credit is not unfiled spending.
      if (row.amount < 0) {
        unfiled = unfiled.plus(toDecimal(row.amount).abs());
        unfiledRows += 1;
      }
      continue;
    }
    if (kind !== 'expense') continue;

    const categoryId = row.category;
    if (!categoryId) continue;
    // Expenses are stored negative, so negating yields positive spending —
    // and a positive-amount refund correctly SUBTRACTS.
    const contribution = toDecimal(row.amount).negated();
    const current = totals.get(categoryId) ?? { total: ZERO, rows: 0 };
    totals.set(categoryId, { total: current.total.plus(contribution), rows: current.rows + 1 });
  }

  const byCategory = new Map<string, CategorySpend>();
  for (const [categoryId, { total, rows }] of totals) {
    // Netted below zero means refunds outweighed spending: the year cost
    // nothing, and no budget follows from it.
    const annual = total.isNegative() ? ZERO : total;
    if (annual.isZero() && rows === 0) continue;
    byCategory.set(categoryId, {
      categoryId,
      annual,
      monthly: annual.dividedBy(12),
      rows,
    });
  }

  return { window, byCategory, unfiled, unfiledRows };
}

/**
 * Roll leaf spending up to the groups the categories sit under — the context
 * column, so a leaf figure can be read against the group it belongs to
 * (owner's ruling: budgets are set at the leaf, groups are shown for
 * context).
 *
 * Keyed by the GROUP's id. A leaf whose parent is missing from `categories`
 * contributes to nothing rather than to a phantom group.
 */
export function groupSubtotals(
  summary: CategorySpendSummary,
  categories: Category[]
): Map<string, DecimalInstance> {
  const parentOf = new Map(categories.map(c => [c.id, c.parentId ?? null]));
  const groups = new Map<string, DecimalInstance>();
  for (const spend of summary.byCategory.values()) {
    const parent = parentOf.get(spend.categoryId);
    if (!parent) continue;
    groups.set(parent, (groups.get(parent) ?? ZERO).plus(spend.annual));
  }
  return groups;
}

/**
 * The twin of a figure the user typed: a monthly budget's year, or a yearly
 * budget's month. The whole of the owner's "type either and see the other",
 * in one place so the screen and any future caller cannot disagree by a
 * rounding.
 */
export function twinOf(
  amount: DecimalInstance | number | string,
  typedAs: 'monthly' | 'yearly'
): DecimalInstance {
  const value = toDecimal(amount);
  return typedAs === 'monthly' ? value.times(12) : value.dividedBy(12);
}
