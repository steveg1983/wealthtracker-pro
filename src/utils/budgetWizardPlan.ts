/**
 * A BUDGET IS A PROPERTY OF ITS CATEGORY — the arithmetic behind the wizard
 * that sets them, kept pure so the screen above it only has to render.
 *
 * The owner's ruling (31 Aug 2026, signed off verbatim): a budget is not a
 * separate object that happens to share a category's name. It is one of that
 * category's properties, stored where it always was — the `budgets` table,
 * keyed by `category_id` — and shown through two lenses:
 *
 *   Manage → Categories   "WHAT IS SET".  Every category row carries its
 *                         budget, as stored, in its own column.
 *   Budget page           "HOW IS IT GOING". Untouched, reading the same rows.
 *
 * The wizard is the third door and the only one that WRITES in bulk, so every
 * rule about what a write means lives here, in one tested place, rather than
 * being re-derived by a component that also has to lay out a grid.
 *
 * ── THE WINDOW: TWELVE COMPLETE MONTHS ─────────────────────────────────────
 * The history is the last twelve COMPLETE calendar months. The current,
 * part-finished month is excluded — a budget set against a month that has not
 * happened yet is set against a category that reads low by however much of the
 * month is left, and every figure on the screen would be quietly short.
 *
 * The window is NAMED on screen ("Sep 2025 – Aug 2026") rather than described
 * ("the last year"), because those are different claims and only one of them
 * can be checked by the person reading it. The label is built with the app's
 * own locale seam (`getDateLocale`, en-GB by default) and the en-dash-with-
 * spaces separator the import screens already use for a month range, so the
 * same range never appears in two spellings.
 *
 * ── WHAT COUNTS AS SPENDING, AND WHAT IS NOT EVEN A ROW ────────────────────
 * Neither question is answered here from scratch. Both defer to the classifier
 * the reports use (`utils/incomeExpense`), reached two ways:
 *
 *   The HISTORY comes from `summariseCategorySpend`, which classifies every
 *   row with `classifyFlow` — so transfers between your own accounts are out
 *   (moving money is not spending it), income is out, and revaluations are out
 *   (a fund falling in value is not an expenditure). Splits are expanded, so a
 *   shop split between two categories lands in both.
 *
 *   The ROWS come from `categoryKindOf`, the same module's per-category half.
 *   A category is budgetable only if its own kind is 'expense'. That one test
 *   excludes income categories (out of scope for v1), the account transfer
 *   categories, the revaluation category and the importer's unassigned bucket
 *   — without this module holding its own list of special ids that could drift
 *   out of step with the reports'.
 *
 * ── EMPTY IS NOT ZERO ──────────────────────────────────────────────────────
 * The distinction the whole write depends on:
 *
 *   ''   (empty box)  UNBUDGETED. No budget row. If one existed, it is REMOVED
 *                     — clearing a figure is how you take a budget off, and
 *                     step 3 says so by name before anything happens.
 *   '0'  (typed zero) A REAL BUDGET, of nothing. "I intend to spend nothing
 *                     here" is a target somebody can be over. It is written.
 *
 * A box nobody has touched is a third state again: `undefined` rather than ''.
 * It means "as it was" — an existing budget survives untouched, a category
 * without one stays without one. Only a box somebody actually emptied removes.
 *
 * ── A WRITE HAPPENS ONLY WHERE THE MONEY CHANGED ───────────────────────────
 * Comparison is on the MONTHLY EQUIVALENT, never on the typed figure. Somebody
 * who has £1,200/yr stored, opens the wizard in monthly mode and leaves the
 * pre-filled £100 alone has changed nothing — and rewriting that row as
 * £100/mo would churn a stored period for no gain, breaking nothing visibly
 * but making a "12 budgets updated" report out of a session that updated none.
 *
 * ── PERIODS THE WIZARD CANNOT EXPRESS ARE LEFT ALONE ───────────────────────
 * `budgets.period` also allows 'weekly', 'quarterly' and 'custom'. The wizard
 * asks one question — months or years — so it has no honest way to re-express
 * a weekly allowance, and dividing one into a month is a guess (four weeks?
 * 4.348?). Such a row is shown with its stored figure, read-only, pointing at
 * the Budget page, and is in NEITHER list: never rewritten, never removed.
 * Refusing loudly beats converting quietly.
 *
 * ── MONEY IS DECIMAL FROM END TO END ───────────────────────────────────────
 * Every figure in and out of this module is a Decimal. The typed string is
 * parsed by `parseMoneyInput` (the app's money parser: pennies, ROUND_HALF_UP,
 * and null for anything that is not a plain number) and is a Decimal from that
 * point on. The twin — ×12 or ÷12 — is Decimal arithmetic quantised to two
 * places, so £1,000/yr reads £83.33/mo rather than 83.33333333333333.
 */

import { toDecimal, parseMoneyInput, type DecimalInstance } from './decimal';
import { categoryKindOf } from './incomeExpense';
import {
  spendWindow,
  summariseCategorySpend,
  type CategorySpendSummary,
  type SpendWindowKind,
} from './categorySpendSummary';
import { getDateLocale } from './dateFormatter';
import type { Budget, Category, Transaction, TransactionSplit } from '../types';

const ZERO = toDecimal(0);
const MONTHS_IN_YEAR = 12;

/** The two rhythms the wizard can write. `budgets.period` allows more (see the header). */
export type BudgetMode = 'monthly' | 'yearly';

/** Below this, two monthly figures are the same money — half a penny. */
const SAME_MONEY = toDecimal('0.005');

export interface BudgetHistoryWindow {
  /** Inclusive ISO date of the first day of the earliest complete month. */
  from: string;
  /** Inclusive ISO date of the last day of the most recent complete month. */
  to: string;
  /** "Sep 2025 – Aug 2026" — the range named, so it can be checked. */
  label: string;
}

/** The measurement windows the wizard offers. All are exactly twelve months. */
export type WizardWindowKind = Extract<SpendWindowKind, 'full-months' | 'calendar-year' | 'tax-year'>;

/**
 * The chosen twelve-month window, named so it can be checked.
 *
 * 'full-months' (the default) is the twelve complete calendar months before
 * the month `now` falls in — the month `now` is in is never one of them,
 * INCLUDING on its last day: 31 August is still inside August, and August
 * completes at midnight. 'calendar-year' and 'tax-year' are the last
 * COMPLETE such year (owner, 1 Sep 2026: a calendar-year budgeter sets this
 * year's budgets against Jan–Dec of last year, part-way through and
 * unbothered). The RANGES all come from `spendWindow`, which is also what
 * the summariser sums over — one source, so the label and the figures
 * cannot describe different windows.
 */
export function budgetHistoryWindow(
  now: Date,
  kind: WizardWindowKind = 'full-months'
): BudgetHistoryWindow {
  const window = spendWindow(kind, now);
  const part = (isoDate: string): Date => {
    const [year, month1, day] = isoDate.split('-').map(Number);
    return new Date(year, month1 - 1, day);
  };
  const monthLabel = (d: Date): string =>
    d.toLocaleDateString(getDateLocale(), { month: 'short', year: 'numeric' });
  const dayLabel = (d: Date): string =>
    d.toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  const from = part(window.from);
  const to = part(window.to);
  const label =
    kind === 'tax-year'
      ? // The 6th-to-5th boundary is the whole point of a tax year — month
        // names alone would print "Apr 2025 – Apr 2026" and look like an error.
        `${dayLabel(from)} – ${dayLabel(to)}`
      : kind === 'calendar-year'
        ? `${from.toLocaleDateString(getDateLocale(), { month: 'short' })} – ${monthLabel(to)}`
        : `${monthLabel(from)} – ${monthLabel(to)}`;
  return { from: window.from, to: window.to, label };
}

/**
 * The twin of a typed figure: a monthly budget's year, or a yearly budget's
 * month, at two places.
 *
 * Quantised here rather than at the point of display because the twin is a
 * MONEY figure in its own right — the thing the user is agreeing to when they
 * press apply — and £83.33333… is not a sum anybody can hold.
 */
export function twinFigure(amount: DecimalInstance | number | string, typedAs: BudgetMode): DecimalInstance {
  const value = toDecimal(amount);
  const twin = typedAs === 'monthly' ? value.times(MONTHS_IN_YEAR) : value.dividedBy(MONTHS_IN_YEAR);
  return twin.toDecimalPlaces(2);
}

/** A stored amount as its per-month equivalent — the currency every comparison is made in. */
export function monthlyEquivalent(amount: DecimalInstance | number | string, period: BudgetMode): DecimalInstance {
  const value = toDecimal(amount);
  return period === 'monthly' ? value : value.dividedBy(MONTHS_IN_YEAR);
}

/**
 * A figure ready to sit IN a box: two places, plain, no symbol and no
 * thousands separator, because it is going into a text input the user then
 * edits and types over. `formatCurrency` is for reading; this is for typing.
 */
export function boxFigure(amount: DecimalInstance | number | string): string {
  return toDecimal(amount).toDecimalPlaces(2).toString();
}

/** A stored amount in the mode being typed, ready to pre-fill a box. */
export function amountInMode(
  amount: DecimalInstance | number | string,
  storedAs: BudgetMode,
  mode: BudgetMode
): DecimalInstance {
  const value = toDecimal(amount);
  if (storedAs === mode) return value.toDecimalPlaces(2);
  return twinFigure(value, storedAs);
}

/**
 * The stored period as one of the two the wizard writes — or null when it is
 * one it refuses to re-express (see the header). Blank/absent reads as
 * monthly, which is what a budget without a stated period means everywhere
 * else in the app (`utils/budgetPeriods` makes the same choice for the same
 * reason).
 */
export function wizardPeriodOf(period: string | null | undefined): BudgetMode | null {
  const value = (period ?? '').trim().toLowerCase();
  if (value === '' || value === 'monthly') return 'monthly';
  if (value === 'yearly' || value === 'annual' || value === 'annually') return 'yearly';
  return null;
}

/** "/mo", "/yr" — the suffix that makes a bare amount a rate, for the Categories column. */
export function budgetPeriodSuffix(period: string | null | undefined): string {
  switch ((period ?? '').trim().toLowerCase()) {
    case 'weekly': return '/wk';
    case 'biweekly':
    case 'bi-weekly': return '/fortnight';
    case 'quarterly': return '/qtr';
    case 'yearly':
    case 'annual':
    case 'annually': return '/yr';
    case 'custom': return '';
    default: return '/mo';
  }
}

/** A budget already stored against a category, as the wizard needs to read it. */
export interface ExistingBudget {
  id: string;
  categoryId: string;
  amount: DecimalInstance;
  /** null when the stored period is one the wizard will not re-express. */
  period: BudgetMode | null;
  /** The raw stored period, for the read-only note on a refused row. */
  storedPeriod: string;
}

/** One line of the grid: a category, what it cost, and what is budgeted on it. */
export interface WizardRow {
  category: Category;
  /** The group this row sits under — '' for a row with no parent group. */
  groupName: string;
  groupId: string | null;
  /** What the window cost, positive, netted of refunds. */
  annual: DecimalInstance;
  /** The same year per month — exactly annual ÷ 12. */
  monthly: DecimalInstance;
  /** How many rows made the figure up: evidence it is not one freak charge. */
  rows: number;
  existing: ExistingBudget | null;
  /** True when this row takes typing. False for a parent shown only as a subtotal. */
  editable: boolean;
}

/** A parent and the rows filed under it, with its display-only roll-up. */
export interface WizardGroup {
  id: string;
  name: string;
  /** Sum of the children's years — context, never an input. */
  annual: DecimalInstance;
  monthly: DecimalInstance;
  rows: WizardRow[];
}

/**
 * Every budget the wizard can see, indexed by category.
 *
 * Inactive budgets are skipped: a deactivated budget is one the user has
 * already taken out of play on the Budget page, and resurrecting it here
 * because the wizard happened to touch its category would undo that silently.
 * Where a category somehow carries two active budgets, the FIRST wins and the
 * rest are ignored rather than being fought over — the wizard writes one
 * budget per category, which is the invariant the whole model rests on.
 */
export function indexExistingBudgets(budgets: Budget[]): Map<string, ExistingBudget> {
  const byCategory = new Map<string, ExistingBudget>();
  for (const budget of budgets) {
    if (budget.isActive === false) continue;
    if (!budget.categoryId || byCategory.has(budget.categoryId)) continue;
    byCategory.set(budget.categoryId, {
      id: budget.id,
      categoryId: budget.categoryId,
      amount: toDecimal(budget.amount),
      period: wizardPeriodOf(budget.period),
      storedPeriod: budget.period,
    });
  }
  return byCategory;
}

/**
 * Is this a category a budget can be a property OF?
 *
 * Expense kinds only, and active ones. `categoryKindOf` is the reports' own
 * per-category classifier, so transfer categories, the revaluation category
 * and the unassigned bucket are excluded by the same rule that keeps their
 * transactions out of the history — one decision, not two that can drift.
 */
export function isBudgetableCategory(category: Category): boolean {
  if (category.isActive === false) return false;
  return categoryKindOf(category) === 'expense';
}

/**
 * The grid: budgetable categories, their history and their budgets.
 *
 * WHERE THE INPUTS GO. Transactions are filed at the DETAIL level, so that is
 * where a budget can be measured without ambiguity and that is where the boxes
 * are. A parent ('sub') row shows its children's roll-up and takes no typing —
 * budgeting both a group and its children would double-count, and which of the
 * two the Budget page should measure would be a question with two answers.
 *
 * ONE EXCEPTION, and it is not an invention: a group that ALREADY has a budget
 * gets a box. The wizard edits the world as it is, and a group budget somebody
 * set on the Budget page is part of that world — showing it read-only would
 * make step 3's total disagree with the Budget page, and hiding it would offer
 * a "remove" the user never got to make. The wizard never CREATES one.
 */
export function buildWizardRows(
  summary: CategorySpendSummary,
  categories: Category[],
  budgets: Budget[]
): WizardRow[] {
  const existingByCategory = indexExistingBudgets(budgets);
  const nameById = new Map(categories.map(c => [c.id, c.name]));

  return categories
    .filter(isBudgetableCategory)
    .filter(c => c.level === 'detail' || existingByCategory.has(c.id))
    .map(category => {
      const spend = summary.byCategory.get(category.id);
      const parentId = category.parentId ?? null;
      return {
        category,
        groupId: parentId,
        groupName: (parentId !== null ? nameById.get(parentId) : undefined) ?? '',
        annual: spend?.annual ?? ZERO,
        monthly: spend?.monthly ?? ZERO,
        rows: spend?.rows ?? 0,
        existing: existingByCategory.get(category.id) ?? null,
        editable: true,
      };
    });
}

/**
 * The rows arranged as the grid shows them: under their parent, biggest spend
 * first inside each group, biggest group first.
 *
 * Biggest-first because that is the order the decisions matter in — the
 * categories worth arguing about are the ones with money in them — and a name
 * tie-break so the order is stable rather than dependent on load order.
 */
export function groupWizardRows(rows: WizardRow[]): WizardGroup[] {
  const byGroup = new Map<string, WizardGroup>();
  const byName = (a: WizardRow, b: WizardRow): number =>
    a.category.name.localeCompare(b.category.name, undefined, { sensitivity: 'base' });

  for (const row of rows) {
    const id = row.groupId ?? '';
    const group = byGroup.get(id) ?? { id, name: row.groupName, annual: ZERO, monthly: ZERO, rows: [] };
    group.rows.push(row);
    group.annual = group.annual.plus(row.annual);
    group.monthly = group.monthly.plus(row.monthly);
    byGroup.set(id, group);
  }

  for (const group of byGroup.values()) {
    group.rows.sort((a, b) => b.annual.comparedTo(a.annual) || byName(a, b));
  }

  return [...byGroup.values()].sort(
    (a, b) =>
      b.annual.comparedTo(a.annual) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

/**
 * What the user has typed, by category id.
 *
 * ABSENT   the box has not been touched — leave the world as it is.
 * ''       emptied — unbudgeted, and REMOVE any budget that was there.
 * '0'      a deliberate zero, which is a budget and is written.
 */
export type WizardEntries = Readonly<Record<string, string | undefined>>;

/**
 * What a box actually holds: what was typed, else what is stored, else empty.
 *
 * ONE function, because the grid DRAWS the boxes and three separate totals SUM
 * them, and a screen where the drawing and the summing disagree is the bug
 * this was written to make impossible. A row the wizard will not re-express
 * reads empty here for the same reason its box is read-only: nothing in it is
 * being typed.
 */
export function wizardBoxValue(row: WizardRow, entries: WizardEntries, mode: BudgetMode): string {
  const typed = entries[row.category.id];
  if (typed !== undefined) return typed;
  if (row.existing === null || row.existing.period === null) return '';
  return boxFigure(amountInMode(row.existing.amount, row.existing.period, mode));
}

/** What a set of boxes adds up to, both ways round, and how many were filled. */
export interface WizardBudgetTotal {
  /** The sum in the mode being typed — the figure under "Your budget, per …". */
  typed: DecimalInstance;
  /** The same money the other way round — the figure under "Which is …". */
  twin: DecimalInstance;
  /**
   * How many boxes carried a figure. ZERO MEANS THERE IS NO TOTAL, not a
   * total of zero: an empty box is unbudgeted and £0.00 is a budget of
   * nothing, and a screen that prints the second when it means the first has
   * invented a decision nobody made.
   */
  boxes: number;
}

/**
 * The running total of a set of boxes — the scoreboard's "Budgeted so far"
 * over every row, and each group heading's own figure over its own rows.
 *
 * ONE piece of arithmetic for both (owner, 2 Sep 2026: "There should be a
 * total for each category grouping"), so the group figures and the strip above
 * them can never disagree: in the mode being typed the group totals ADD UP to
 * the scoreboard's, exactly, because they are the same sum taken over disjoint
 * sets of the same boxes.
 *
 * Summed as a YEAR and turned back into a month once at the end, never row by
 * row: that is the currency `planBudgetWrites` compares in, and dividing
 * twelve rows before adding them rounds twelve times instead of once.
 *
 * Left out, here and in the write both: a stored period the wizard will not
 * re-express (a week does not divide into a month without a guess) and a
 * figure that will not parse as money (named in step 3, never guessed at).
 */
export function totalBudgeted(
  rows: WizardRow[],
  entries: WizardEntries,
  mode: BudgetMode
): WizardBudgetTotal {
  let annual = ZERO;
  let boxes = 0;

  for (const row of rows) {
    if (row.existing !== null && row.existing.period === null) continue;
    const value = wizardBoxValue(row, entries, mode);
    if (value.trim() === '') continue;
    const parsed = parseMoneyInput(value);
    if (parsed === null || parsed < 0) continue;
    const amount = toDecimal(parsed);
    annual = annual.plus(mode === 'monthly' ? amount.times(MONTHS_IN_YEAR) : amount);
    boxes += 1;
  }

  const perYear = annual.toDecimalPlaces(2);
  const perMonth = twinFigure(annual, 'yearly');
  return mode === 'monthly'
    ? { typed: perMonth, twin: perYear, boxes }
    : { typed: perYear, twin: perMonth, boxes };
}

export interface BudgetUpsert {
  categoryId: string;
  categoryName: string;
  /** Present when this edits a stored budget; absent when it creates one. */
  budgetId?: string;
  /** The figure to store, in `period`. Always two places. */
  amount: DecimalInstance;
  period: BudgetMode;
  /** The same money per month — what the totals are summed in. */
  monthly: DecimalInstance;
}

export interface BudgetRemoval {
  budgetId: string;
  categoryId: string;
  categoryName: string;
}

/** A row whose typed figure could not be read as money — reported, never guessed at. */
export interface BudgetRejection {
  categoryId: string;
  categoryName: string;
  raw: string;
}

export interface BudgetWritePlan {
  upserts: BudgetUpsert[];
  removals: BudgetRemoval[];
  rejections: BudgetRejection[];
  /** How many categories carry a budget once this plan is applied. */
  budgetedCount: number;
  /** The per-month total of every budget that will exist afterwards. */
  monthlyTotal: DecimalInstance;
  /** The same total per year — monthlyTotal × 12, at two places. */
  annualTotal: DecimalInstance;
  /** What those same categories actually cost over the window. */
  spentTotal: DecimalInstance;
  /**
   * annualTotal − spentTotal. POSITIVE means the budgets allow more than the
   * year cost (headroom); NEGATIVE means they allow less than was really
   * spent, which is the number worth saying out loud.
   */
  difference: DecimalInstance;
}

/**
 * The whole write, decided before anything is written.
 *
 * Given the world (rows carrying their existing budgets) and the wizard's
 * state (what was typed, in which mode), produce the two lists — and the
 * totals step 3 shows, computed from the SAME lists the apply pass walks, so
 * the confirmation cannot describe a different write from the one that runs.
 *
 * A row with a period the wizard will not re-express is passed over entirely:
 * it is in neither list, and its money is still counted in the totals, because
 * it will still exist afterwards and pretending otherwise would understate
 * what the user is committing to.
 */
export function planBudgetWrites(
  rows: WizardRow[],
  entries: WizardEntries,
  mode: BudgetMode
): BudgetWritePlan {
  const upserts: BudgetUpsert[] = [];
  const removals: BudgetRemoval[] = [];
  const rejections: BudgetRejection[] = [];
  let monthlyTotal = ZERO;
  let spentTotal = ZERO;
  let budgetedCount = 0;

  /** This row will carry `monthly` a month afterwards; count it in the totals. */
  const willBudget = (row: WizardRow, monthly: DecimalInstance): void => {
    budgetedCount += 1;
    monthlyTotal = monthlyTotal.plus(monthly);
    spentTotal = spentTotal.plus(row.annual);
  };

  for (const row of rows) {
    const raw = entries[row.category.id];
    const existing = row.existing;

    // A stored period the wizard cannot express: untouchable, but real, and
    // its money still counts towards what the user is agreeing to.
    if (existing !== null && existing.period === null) {
      budgetedCount += 1;
      spentTotal = spentTotal.plus(row.annual);
      continue;
    }

    // UNTOUCHED — the world stands. An existing budget carries on, converted
    // to a month for the total only; nothing is written and its stored period
    // is not disturbed.
    if (raw === undefined) {
      if (existing !== null && existing.period !== null) {
        willBudget(row, monthlyEquivalent(existing.amount, existing.period));
      }
      continue;
    }

    // EMPTIED — unbudgeted. Removal only where there was something to remove.
    if (raw.trim() === '') {
      if (existing !== null) {
        removals.push({
          budgetId: existing.id,
          categoryId: row.category.id,
          categoryName: row.category.name,
        });
      }
      continue;
    }

    // TYPED — money, or nothing at all. A figure that will not parse is never
    // guessed at: the row is reported and left exactly as it was.
    const parsed = parseMoneyInput(raw);
    if (parsed === null || parsed < 0) {
      rejections.push({ categoryId: row.category.id, categoryName: row.category.name, raw });
      if (existing !== null && existing.period !== null) {
        willBudget(row, monthlyEquivalent(existing.amount, existing.period));
      }
      continue;
    }

    const amount = toDecimal(parsed);
    const monthly = monthlyEquivalent(amount, mode);
    willBudget(row, monthly);

    // Unchanged money is not a write — compared as months, so switching mode
    // without changing the figure writes nothing (see the header).
    if (existing !== null && existing.period !== null) {
      const before = monthlyEquivalent(existing.amount, existing.period);
      if (before.minus(monthly).abs().lessThan(SAME_MONEY)) continue;
    }

    upserts.push({
      categoryId: row.category.id,
      categoryName: row.category.name,
      ...(existing !== null ? { budgetId: existing.id } : {}),
      amount,
      period: mode,
      monthly,
    });
  }

  const annualTotal = monthlyTotal.times(MONTHS_IN_YEAR).toDecimalPlaces(2);
  return {
    upserts,
    removals,
    rejections,
    budgetedCount,
    monthlyTotal: monthlyTotal.toDecimalPlaces(2),
    annualTotal,
    spentTotal: spentTotal.toDecimalPlaces(2),
    difference: annualTotal.minus(spentTotal.toDecimalPlaces(2)),
  };
}

/**
 * The history for the whole wizard, over the fixed twelve-month window.
 *
 * A thin composition on purpose: the aggregation itself is
 * `summariseCategorySpend`, which the reports' classifier drives, so this
 * screen and the reports can never disagree about what a category cost. The
 * only thing added here is that the window is not a choice — see the header.
 */
export function summariseForWizard(
  transactions: Transaction[],
  splits: TransactionSplit[],
  categories: Category[],
  now: Date,
  kind: WizardWindowKind = 'full-months'
): CategorySpendSummary {
  return summariseCategorySpend(transactions, splits, categories, { kind, now });
}
