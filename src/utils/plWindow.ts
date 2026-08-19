import { getDateLocale } from './dateFormatter';

/**
 * THE P&L's WINDOWS — the "twelve months" a profit-and-loss can mean.
 *
 * The owner's ask (19 Aug): "We should offer the user a few different
 * '12 months'" — the last full calendar year, the last tax year, the last
 * full twelve months ("not including a current part month"), and custom.
 * Each window is a list of MONTH BUCKETS carrying their own [start,
 * endExclusive) day range, because one of them cannot be described by
 * calendar months at all:
 *
 * ── TAX MONTHS RUN 6th TO 5th ──────────────────────────────────────────────
 *
 * The UK tax year runs 6 April to 5 April, so its "months" are HMRC's tax
 * months — 6 April to 5 May is month 1, exactly as payroll counts them.
 * Splitting the tax year on calendar months instead would give thirteen
 * columns with part-months at both ends, and a total that no longer reads
 * as the sum of its columns. Twelve true twelfths, each 6th-to-5th, keeps
 * both properties. The page says the convention on screen.
 *
 * ── DAYS ARE STRINGS, COMPARED AS STRINGS ──────────────────────────────────
 *
 * Every boundary here is a YYYY-MM-DD string and rows are bucketed by
 * LEXICAL comparison — deliberately. Date parsing is where the timezone
 * bugs live (V8's fallback parser reads at local midnight, the standard
 * form at UTC midnight; the admission lane pins TZ=UTC over exactly this),
 * and a P&L must not change its columns with the reader's holiday
 * location. ISO day strings order the same way everywhere.
 */

export type PlWindowKind = 'last-12' | 'calendar-year' | 'tax-year' | 'custom';

export interface PlBucket {
  key: string;
  /** Column heading, e.g. "Aug 25". A tax month is labelled by its 6th. */
  label: string;
  /** First day IN the bucket, YYYY-MM-DD. */
  start: string;
  /** First day AFTER the bucket, YYYY-MM-DD. */
  endExclusive: string;
}

export interface PlWindow {
  kind: PlWindowKind;
  /** The range in words, e.g. "August 2025 to July 2026". */
  label: string;
  buckets: PlBucket[];
  start: string;
  endExclusive: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const isoDay = (year: number, month1: number, day: number): string =>
  `${year}-${pad(month1)}-${pad(day)}`;

/** Normalise an out-of-range month index the way Date does (month0 −1 → last December). */
const normalise = (year: number, month0: number): { year: number; month0: number } => {
  const rolled = new Date(year, month0, 1);
  return { year: rolled.getFullYear(), month0: rolled.getMonth() };
};

const shortLabel = (year: number, month0: number, day: number): string =>
  new Date(year, month0, day).toLocaleDateString(getDateLocale(), { month: 'short', year: '2-digit' });

const longMonth = (year: number, month0: number): string =>
  new Date(year, month0, 1).toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' });

const calendarBuckets = (startYear: number, startMonth0: number, count: number): PlBucket[] =>
  Array.from({ length: count }, (_, i) => {
    const m = normalise(startYear, startMonth0 + i);
    const next = normalise(startYear, startMonth0 + i + 1);
    return {
      key: `${m.year}-${pad(m.month0 + 1)}`,
      label: shortLabel(m.year, m.month0, 1),
      start: isoDay(m.year, m.month0 + 1, 1),
      endExclusive: isoDay(next.year, next.month0 + 1, 1),
    };
  });

/** Twelve HMRC tax months: 6 April startYear … 5 April startYear+1. */
const taxBuckets = (startYear: number): PlBucket[] =>
  Array.from({ length: 12 }, (_, i) => {
    const m = normalise(startYear, 3 + i);
    const next = normalise(startYear, 3 + i + 1);
    return {
      key: `${m.year}-${pad(m.month0 + 1)}-tax`,
      label: shortLabel(m.year, m.month0, 6),
      start: isoDay(m.year, m.month0 + 1, 6),
      endExclusive: isoDay(next.year, next.month0 + 1, 6),
    };
  });

const monthRangeLabel = (buckets: PlBucket[]): string => {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const firstLabel = longMonth(Number(first.start.slice(0, 4)), Number(first.start.slice(5, 7)) - 1);
  const lastLabel = longMonth(Number(last.start.slice(0, 4)), Number(last.start.slice(5, 7)) - 1);
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} to ${lastLabel}`;
};

const finish = (kind: PlWindowKind, label: string, buckets: PlBucket[]): PlWindow => ({
  kind,
  label,
  buckets,
  start: buckets[0].start,
  endExclusive: buckets[buckets.length - 1].endExclusive,
});

const MONTH_INPUT = /^\d{4}-\d{2}$/;

/**
 * Build the chosen window as it stands on `today`. Every window holds only
 * COMPLETE periods — "the last 12 months should be the last full 12 months
 * so not including a current part month" (owner, 19 Aug), and the same
 * completeness rule picks the calendar and tax years.
 */
export function buildPlWindow(
  kind: PlWindowKind,
  today: Date,
  custom?: { fromMonth: string; toMonth: string }
): PlWindow {
  if (kind === 'calendar-year') {
    const year = today.getFullYear() - 1;
    return finish(kind, `January ${year} to December ${year}`, calendarBuckets(year, 0, 12));
  }

  if (kind === 'tax-year') {
    // The last COMPLETE tax year: 2025/26 only once 6 April 2026 has passed —
    // on 5 April 2026 the year ends today and is not yet whole.
    const pastApril6 = today.getMonth() > 3 || (today.getMonth() === 3 && today.getDate() >= 6);
    const startYear = pastApril6 ? today.getFullYear() - 1 : today.getFullYear() - 2;
    return finish(
      kind,
      `6 April ${startYear} to 5 April ${startYear + 1}`,
      taxBuckets(startYear)
    );
  }

  if (kind === 'custom' && custom && MONTH_INPUT.test(custom.fromMonth) && MONTH_INPUT.test(custom.toMonth)) {
    const [from, to] = custom.fromMonth <= custom.toMonth
      ? [custom.fromMonth, custom.toMonth]
      : [custom.toMonth, custom.fromMonth];
    const fromYear = Number(from.slice(0, 4));
    const fromMonth0 = Number(from.slice(5, 7)) - 1;
    const count = (Number(to.slice(0, 4)) - fromYear) * 12 + (Number(to.slice(5, 7)) - 1 - fromMonth0) + 1;
    const buckets = calendarBuckets(fromYear, fromMonth0, count);
    return finish(kind, monthRangeLabel(buckets), buckets);
  }

  // 'last-12', and the fallback for a custom range not yet stated: the last
  // twelve complete months, first of (this month − 12) … end of last month.
  const start = normalise(today.getFullYear(), today.getMonth() - 12);
  const buckets = calendarBuckets(start.year, start.month0, 12);
  return finish(kind === 'custom' ? 'custom' : 'last-12', monthRangeLabel(buckets), buckets);
}

/** The bucket a day lands in, or −1 when the window does not hold it. */
export function bucketIndexOf(day: string, buckets: PlBucket[]): number {
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (day < buckets[mid].start) hi = mid - 1;
    else if (day >= buckets[mid].endExclusive) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * A row's day as YYYY-MM-DD. A string is sliced, never parsed; a Date reads
 * its LOCAL day, matching how the rest of the app renders it.
 */
export const dayOf = (date: Date | string): string =>
  typeof date === 'string'
    ? date.slice(0, 10)
    : isoDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
