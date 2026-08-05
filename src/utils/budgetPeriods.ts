/**
 * The window a budget is currently being measured over.
 *
 * WHY this exists: the Budget page and the notification service each derived
 * the window themselves, and both wrote the same two-branch guess —
 * "monthly, else the whole calendar year". A weekly budget therefore compared
 * a week's allowance against a YEAR of spending on the alerts path, and a
 * quarterly or custom one did the same on both. The card caption repeated the
 * guess in words ("Yearly budget" for anything that was not monthly), so the
 * screen agreed with itself while being wrong.
 *
 * One derivation, used by every surface, is the only way those can never drift
 * apart again.
 *
 * BOUNDARIES: windows are inclusive and run to the LAST MILLISECOND of the end
 * day. The old code ended a month at `new Date(y, m + 1, 0)` — local midnight —
 * which dropped the final day of every month for anyone west of the row's
 * timestamp (a date-only "2026-08-31" off the wire is UTC midnight, i.e. 01:00
 * local under BST, which is already past a midnight boundary).
 */

import { toDateMs } from './dateBoundary';

/** Every period a budget can be measured over. */
export type BudgetPeriodName = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

/**
 * What a window is derived FROM. Structural on purpose: `Budget`,
 * `DecimalBudget` and the recommendation service's drafts all satisfy it
 * without conversion, and `period` is a plain string because rows written by
 * older builds (and by the recurring-template importer) carry values the
 * current union has never listed.
 */
export interface BudgetPeriodSource {
  period?: string | null;
  /** Custom periods only — the stored `budgets.start_date`. */
  startDate?: string | Date | null;
  /** Custom periods only — the stored `budgets.end_date`. */
  endDate?: string | Date | null;
  /** Fallback anchor for a fortnightly budget with no start date. */
  createdAt?: string | Date | null;
}

export interface BudgetPeriodWindow {
  /** First instant counted (local start of day). */
  start: Date;
  /** Last instant counted (local end of day, inclusive). */
  end: Date;
  /** The period the window was derived for. */
  period: BudgetPeriodName;
  /** Caption for the card — "Monthly", "Fortnightly", … */
  label: string;
}

const PERIOD_LABELS: Record<BudgetPeriodName, string> = {
  weekly: 'Weekly',
  biweekly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
};

/** Days in a fortnight — the biweekly step. */
const FORTNIGHT_DAYS = 14;

/**
 * A stored period string as one of the periods we can measure.
 *
 * Unknown/blank falls back to MONTHLY, not yearly: a monthly allowance is what
 * a budget without a stated period means everywhere else in the app, and the
 * old yearly fallback is precisely what made a week's budget read a year of
 * spending.
 */
export function normaliseBudgetPeriod(period: string | null | undefined): BudgetPeriodName {
  switch ((period ?? '').trim().toLowerCase()) {
    case 'weekly':
      return 'weekly';
    case 'biweekly':
    case 'bi-weekly':
    case 'fortnightly':
      return 'biweekly';
    case 'quarterly':
      return 'quarterly';
    case 'yearly':
    case 'annual':
    case 'annually':
      return 'yearly';
    case 'custom':
      return 'custom';
    default:
      return 'monthly';
  }
}

/** The caption a card shows for a period — "Fortnightly", "Quarterly", … */
export function getBudgetPeriodLabel(period: string | null | undefined): string {
  return PERIOD_LABELS[normaliseBudgetPeriod(period)];
}

/** Local start of the given calendar day. */
function startOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0);
}

/** Local end of the given calendar day — inclusive upper bound. */
function endOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 23, 59, 59, 999);
}

interface DayParts {
  year: number;
  month: number;
  day: number;
}

function partsOf(date: Date): DayParts {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

/**
 * The calendar day a stored value names, or null when it names none.
 *
 * A date-only "2026-08-01" is read as the LOCAL 1 August, not as UTC midnight:
 * these are period boundaries a person chose, and a boundary that lands an hour
 * before the day it names would quietly drop or add a day's spending.
 */
function toDayParts(value: string | Date | null | undefined): DayParts | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (dateOnly) {
      return { year: Number(dateOnly[1]), month: Number(dateOnly[2]) - 1, day: Number(dateOnly[3]) };
    }
  }
  const ms = toDateMs(value);
  if (!Number.isFinite(ms)) return null;
  return partsOf(new Date(ms));
}

/** Whole days from `from` to `to`, DST-proof (compared as UTC calendar days). */
function daysBetween(from: DayParts, to: DayParts): number {
  const fromMs = Date.UTC(from.year, from.month, from.day);
  const toMs = Date.UTC(to.year, to.month, to.day);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * The period a budget is currently being measured over.
 *
 * - weekly: the current week. Sunday-start, unchanged from what the Budget
 *   page has always drawn — a silent shift to Monday would move every weekly
 *   figure on the page without anyone asking for it.
 * - biweekly: the fortnight containing `now`, counted from the budget's own
 *   start date (or, failing that, the day it was created). A fortnight has no
 *   calendar boundary to sit on, so the budget's own anchor is the only honest
 *   one.
 * - monthly / quarterly / yearly: the calendar month, quarter and year.
 * - custom: the stored start/end dates. A custom budget missing them falls
 *   back to the current month — stated in the code rather than silently
 *   inherited, and still captioned "Custom" so the card never claims a period
 *   the budget does not have.
 */
export function getBudgetPeriodWindow(
  budget: BudgetPeriodSource,
  now: Date = new Date()
): BudgetPeriodWindow {
  const period = normaliseBudgetPeriod(budget.period);
  const label = PERIOD_LABELS[period];
  const today = partsOf(now);

  switch (period) {
    case 'weekly': {
      const weekStartDay = today.day - now.getDay();
      return {
        start: startOfDay(today.year, today.month, weekStartDay),
        end: endOfDay(today.year, today.month, weekStartDay + 6),
        period,
        label,
      };
    }

    case 'biweekly': {
      const anchor =
        toDayParts(budget.startDate) ??
        toDayParts(budget.createdAt) ??
        { year: today.year, month: today.month, day: today.day - now.getDay() };
      const elapsed = daysBetween(anchor, today);
      // Before the anchor (a budget that starts in the future) the first
      // fortnight is the answer, not a phantom one behind it.
      const index = Math.max(0, Math.floor(elapsed / FORTNIGHT_DAYS));
      const startDay = anchor.day + index * FORTNIGHT_DAYS;
      return {
        start: startOfDay(anchor.year, anchor.month, startDay),
        end: endOfDay(anchor.year, anchor.month, startDay + FORTNIGHT_DAYS - 1),
        period,
        label,
      };
    }

    case 'quarterly': {
      const firstMonth = Math.floor(today.month / 3) * 3;
      return {
        start: startOfDay(today.year, firstMonth, 1),
        // Day 0 of the month AFTER the quarter is the quarter's last day.
        end: endOfDay(today.year, firstMonth + 3, 0),
        period,
        label,
      };
    }

    case 'yearly':
      return {
        start: startOfDay(today.year, 0, 1),
        end: endOfDay(today.year, 11, 31),
        period,
        label,
      };

    case 'custom': {
      const start = toDayParts(budget.startDate);
      if (start) {
        // No end date means "from the start date until now" — an open-ended
        // custom period, measured as far as it has run.
        const end = toDayParts(budget.endDate) ?? today;
        return {
          start: startOfDay(start.year, start.month, start.day),
          end: endOfDay(end.year, end.month, end.day),
          period,
          label,
        };
      }
      return {
        start: startOfDay(today.year, today.month, 1),
        end: endOfDay(today.year, today.month + 1, 0),
        period,
        label,
      };
    }

    case 'monthly':
    default:
      return {
        start: startOfDay(today.year, today.month, 1),
        end: endOfDay(today.year, today.month + 1, 0),
        period,
        label,
      };
  }
}
