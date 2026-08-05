/**
 * "How long have I got, and what does that cost me a month?" — the two
 * questions every goal card answers, in ONE place.
 *
 * WHY this exists: both the Goals page and the shared (household) goals list
 * had their own copy of `Math.ceil((target - Date.now()) / 86_400_000)`. That
 * expression is not a day count, it is a 24-hour-block count measured from
 * whatever o'clock it happens to be:
 *
 *   • A goal due TODAY reads 0 or a negative number for all but the first
 *     instant of the day, so the card said "Overdue" to someone whose deadline
 *     has not arrived yet.
 *   • It measures in UTC-agnostic milliseconds, so around a DST switch (and
 *     for anyone west of Greenwich in the evening) the answer is a day out.
 *   • "1 days left".
 *
 * The count here is a CALENDAR-day difference in local time: both ends are
 * snapped to local midnight first, so "today" is 0, tomorrow is 1, and
 * yesterday is -1 — no matter what the clock says or which side of a DST
 * boundary the two dates fall.
 */

import type { DecimalInstance } from './decimal';
import { toDecimal } from './decimal';
import type { DecimalGoal } from '../types/decimal-types';
import { toDateMs } from './dateBoundary';

/**
 * The average length of a calendar month over the Gregorian 400-year cycle
 * (365.2425 days / 12). Used to turn a day count into months so that a goal
 * 58 days out and one 1 day out never claim the same "1 month" — which is
 * exactly what subtracting calendar-month numbers does.
 */
export const AVERAGE_DAYS_PER_MONTH = 30.436875;

/** Local midnight at the start of the given day. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days from `today` to `target`, in LOCAL time.
 *
 * 0 = due today, positive = still to come, negative = overdue by that many
 * days. A missing or unreadable target gives NaN (goals without a target
 * date exist, and local-mode goals carry wire strings) — it must not throw,
 * and must not silently read as "due today".
 */
export function daysUntil(target: Date | string | null | undefined, today: Date = new Date()): number {
  const targetMs = toDateMs(target);
  const todayMs = today.getTime();
  if (Number.isNaN(targetMs) || Number.isNaN(todayMs)) return Number.NaN;

  const from = startOfLocalDay(today).getTime();
  const to = startOfLocalDay(new Date(targetMs)).getTime();
  // Both ends are local midnight, so the gap is a whole number of days ±1 hour
  // of DST slack — rounding lands it exactly.
  return Math.round((to - from) / 86_400_000);
}

/**
 * The deadline as a person would say it: "Due today", "1 day left",
 * "12 days left", "Overdue by 1 day", "Overdue by 12 days".
 */
export function formatDaysRemaining(days: number): string {
  if (Number.isNaN(days)) return 'No target date';
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  if (days > 1) return `${days} days left`;
  if (days === -1) return 'Overdue by 1 day';
  return `Overdue by ${Math.abs(days)} days`;
}

/** A deadline worth colouring red: today, overdue, or inside a month. */
export function isDeadlineUrgent(days: number): boolean {
  return !Number.isNaN(days) && days < 30;
}

/**
 * "£X/month to stay on track" — what still has to go in, spread over the time
 * that is actually left.
 *
 * A day-aware wrapper over the same idea as `calculateGoalMonthlyTarget` in
 * calculations-decimal, which derives its month count by subtracting calendar
 * month numbers: 31 Jan → 1 Feb (one day) and 1 Jan → 28 Feb (58 days) both
 * come out as "1 month", so the first understates the monthly ask by 98%.
 * Here the months come from the calendar-day count above.
 *
 * Returns null when there is nothing left to save (goal met or exceeded) or
 * when the target date cannot be read — the caller shows nothing rather than
 * "£0/month", which would read as advice.
 *
 * Fewer than ~30 days left (or already overdue) clamps to one month: the
 * honest answer there is "all of it, now", not a figure inflated by dividing
 * by a fraction of a month.
 */
export function monthlyTargetToStayOnTrack(
  goal: Pick<DecimalGoal, 'targetAmount' | 'currentAmount' | 'targetDate'>,
  today: Date = new Date()
): DecimalInstance | null {
  const remaining = goal.targetAmount.minus(goal.currentAmount);
  if (remaining.lessThanOrEqualTo(0)) return null;

  const days = daysUntil(goal.targetDate, today);
  if (Number.isNaN(days)) return null;

  const months = toDecimal(days).dividedBy(AVERAGE_DAYS_PER_MONTH);
  if (months.lessThanOrEqualTo(1)) return remaining;

  return remaining.dividedBy(months);
}
