/**
 * Where the net-worth line puts its points — shared by the app's forward walk
 * (utils/netWorthSeries) and the connector's backward one (api/_lib/mcp), so
 * the two series land on the same days and a figure Claude quotes for
 * "end of March" is the figure the report's March point shows.
 *
 * Daily for a window of about three months or less, month-end beyond it (the
 * Money cadence), always ending on the window's final day. Pure: no locale,
 * no preferences, nothing a server could not import.
 */

/** Days a window may span before the cadence drops from daily to month-end. */
export const DAILY_CADENCE_MAX_DAYS = 92;

export interface NetWorthCadence {
  points: Date[];
  /** True when the points are month-ends rather than every day. */
  monthly: boolean;
}

/**
 * The points for [start, end], inclusive. Empty when the window is inverted.
 * Month-ends are built with the local constructor (`new Date(y, m + 1, 0)`),
 * so they are local calendar days — never a UTC string parse that would move
 * the boundary for anyone west of Greenwich.
 */
export function netWorthPoints(start: Date, end: Date): NetWorthCadence {
  if (start > end) return { points: [], monthly: false };
  const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
  const points: Date[] = [];
  if (spanDays <= DAILY_CADENCE_MAX_DAYS) {
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      points.push(new Date(d));
    }
    return { points, monthly: false };
  }
  const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  while (cursor < end) {
    points.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 2, 0);
  }
  points.push(new Date(end));
  return { points, monthly: true };
}

/** The last instant of a point's day: a transaction dated that day counts in it. */
export function endOfPoint(point: Date): Date {
  const cutoff = new Date(point);
  cutoff.setHours(23, 59, 59, 999);
  return cutoff;
}
