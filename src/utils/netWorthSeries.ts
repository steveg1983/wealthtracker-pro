import type { Account, Transaction } from '../types';
import { toDecimal } from './decimal';
import { resolveEffectiveOpeningDates } from './openingDates';
import type { PeriodRange } from '../hooks/usePeriod';
import { getDateLocale } from '../utils/dateFormatter';

export interface NetWorthSnapshot {
  date: Date;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

/**
 * A point on the net-worth line, named so a link can carry it.
 *
 * The Dashboard widget and the full report build their series from THIS
 * function over the same window, so a point clicked on the card names the same
 * point on the report. Local calendar parts, not toISOString: the snapshots are
 * local dates (month-ends built with the local constructor), and a UTC string
 * would name the day before for anyone west of Greenwich.
 */
export function netWorthPointToken(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Net worth over time from first principles: per-account running balance
 * (opening balance + cumulative transactions, Decimal throughout) snapshotted
 * at each point in the period. One forward walk — transactions accumulate from
 * the very beginning, so a point inside the window carries ALL history before
 * it. Shared by the Net Worth report and the Dashboard's pinned net-worth
 * widget.
 *
 * An opening balance is a DATED lump, not a figure that has always existed: it
 * is folded in on its effective date (see openingDates.ts), so an account
 * opened in 2011 no longer inflates net worth back to 2008. An account with no
 * datable signal at all still seeds at time-zero — dropping an undated lump
 * from history silently would be worse than overstating it; the report warns
 * about those instead.
 *
 * Point cadence: daily for windows under ~3 months, month-end beyond (the
 * Money cadence), always ending on the window's final day.
 */
export function buildNetWorthSnapshots(
  accounts: Account[],
  transactions: Transaction[],
  range: PeriodRange,
  now: Date = new Date()
): NetWorthSnapshot[] {
  if (accounts.length === 0) return [];

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstTxnDate = sorted.length > 0 ? new Date(sorted[0].date) : now;
  const start = range.from ?? firstTxnDate;
  const end = range.to ?? now;
  if (start > end) return [];

  const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
  const points: Date[] = [];
  if (spanDays <= 92) {
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      points.push(new Date(d));
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    while (cursor < end) {
      points.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 2, 0);
    }
    points.push(new Date(end));
  }

  // Seed every account at zero. An opening balance is a dated lump folded in on
  // its effective date, NOT a figure present from the start; only accounts with
  // no datable signal (rung 4) seed at time-zero, preserving today's behaviour.
  const openingDates = resolveEffectiveOpeningDates(accounts, transactions);
  const balances = new Map<string, ReturnType<typeof toDecimal>>();
  const openingEvents: Array<{ accountId: string; time: number; amount: ReturnType<typeof toDecimal> }> = [];
  for (const a of accounts) {
    const opening = toDecimal(a.openingBalance ?? 0);
    const eff = openingDates.get(a.id);
    if (eff === undefined) {
      balances.set(a.id, opening);
    } else {
      balances.set(a.id, toDecimal(0));
      if (!opening.isZero()) openingEvents.push({ accountId: a.id, time: eff.getTime(), amount: opening });
    }
  }
  openingEvents.sort((x, y) => x.time - y.time);

  const monthly = spanDays > 92;
  let i = 0;
  let j = 0;
  const out: NetWorthSnapshot[] = [];
  for (const point of points) {
    const cutoff = new Date(point);
    cutoff.setHours(23, 59, 59, 999);
    const cutoffTime = cutoff.getTime();
    // Each opening lump appears the moment its effective date is reached — same
    // chronological walk as the transactions, so a point before an account's
    // opening date carries none of its balance.
    while (j < openingEvents.length && openingEvents[j].time <= cutoffTime) {
      const ev = openingEvents[j];
      const bal = balances.get(ev.accountId);
      if (bal !== undefined) balances.set(ev.accountId, bal.plus(ev.amount));
      j++;
    }
    while (i < sorted.length && new Date(sorted[i].date) <= cutoff) {
      const t = sorted[i];
      const bal = balances.get(t.accountId);
      if (bal !== undefined) balances.set(t.accountId, bal.plus(toDecimal(t.amount)));
      i++;
    }
    let assets = toDecimal(0);
    let liabilities = toDecimal(0);
    for (const b of balances.values()) {
      if (b.greaterThan(0)) assets = assets.plus(b);
      else liabilities = liabilities.plus(b.abs());
    }
    out.push({
      date: point,
      // "Apr 2010", never "Apr 10": with the 2-digit year a sixteen-year
      // series read as sixteen days inside one April (Design, 17 Aug §2.3) —
      // and "Apr 10" is an American date besides, in an en-GB app. The daily
      // cadence stays day-first for the same reason.
      label: point.toLocaleDateString(getDateLocale(), monthly
        ? { month: 'short', year: 'numeric' }
        : { day: 'numeric', month: 'short' }),
      assets: assets.toNumber(),
      liabilities: liabilities.toNumber(),
      netWorth: assets.minus(liabilities).toNumber(),
    });
  }
  return out;
}

/**
 * X-axis props for a snapshot series: THE TICK FORMAT FOLLOWS THE SPAN OF THE
 * DOMAIN (Claude Design, 17 Aug §2.3) — years for a multi-year window, month
 * names for a multi-month one, dates within a month. A sixteen-year series was
 * ticking "Apr 10 · Apr 12 · … · Aug 26": nine dates apparently inside one
 * April, with the last tick changing month so it read as a data error rather
 * than a scale.
 *
 * Under two years this returns nothing and recharts thins the month labels
 * itself. From two years up it hands back explicit ticks — the first snapshot
 * of each year, stepped so at most ~9 fit ("2010 · 2012 · …") — plus a
 * formatter that renders each as its bare year. Left to a formatter alone,
 * recharts' own tick choice can land two ticks inside one year and print
 * "2010 · 2010", which is why the positions are supplied too.
 *
 * The full per-point label ("Apr 2010") survives untouched for the tooltip
 * and for click identity — labels are what `activeLabel` hands back, so they
 * must stay unique per point; only the AXIS text compresses.
 */
/**
 * The classic 1-2-5 "nice" step. Deliberately NOT recharts' ladder, which
 * includes 2.5: a 2.5K step renders "0 · 3K · 5K · 8K · 10K" through the
 * compact tick formatter's whole-unit rounding — an axis that looks
 * mis-spaced. Every 1-2-5 multiple survives the formatter intact.
 */
const niceStep = (raw: number): number => {
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  return power * (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10);
};

/**
 * Y-axis domain and ticks for a value series that MAY dip below zero.
 *
 * Exists because recharts' own nice-tick rounding answers any dip below
 * zero, however shallow, by extending the axis floor to the next full tick
 * step DOWN. Measured on the owner's real ledger (19 Aug): an early dip a
 * small fraction of one tick step deep bought the Net Worth chart a floor
 * a FULL step below zero — a quarter of the plot spent on nothing,
 * flattening the curve the chart exists to show. The
 * `domain={[dataMin => Math.min(0, dataMin), 'auto']}` form does NOT
 * prevent this: it sets the data floor, and the tick generator still
 * rounds below it.
 *
 * So the ticks are supplied, not delegated: nice multiples of one step,
 * covering the top of the data, with 0 always among them — and the floor is
 * the DATA's own low point plus 2% breathing room, never a tick-step
 * flourish. A shallow dip shows as a line grazing below the 0 gridline; a
 * genuinely deep negative earns real negative ticks because they then fall
 * inside the domain. All-positive data keeps the 0 floor it always had.
 *
 * Chart geometry, not money arithmetic — floats are fine here.
 */
export function netWorthValueAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const magnitude = Math.max(max, -min);
  if (magnitude === 0) return { domain: [0, 1], ticks: [0, 1] };

  const step = niceStep(magnitude / 5);
  const top = max > 0 ? Math.ceil(max / step - 1e-9) * step : 0;
  const bottom = min < 0 ? min - (top - min) * 0.02 : 0;

  const ticks: number[] = [];
  const first = Math.ceil(bottom / step - 1e-9);
  const last = Math.round(top / step);
  for (let i = first; i <= last; i++) {
    // Integer multiples, so a long axis never drifts off its step — and
    // −0 (which prints as "-0" through some formatters) normalised away.
    ticks.push(i === 0 ? 0 : i * step);
  }
  return { domain: [bottom, top], ticks };
}

export function netWorthAxisTicks(snapshots: NetWorthSnapshot[]): {
  ticks?: string[];
  tickFormatter?: (label: string) => string;
} {
  if (snapshots.length < 2) return {};
  const firstYear = snapshots[0].date.getFullYear();
  const lastYear = snapshots[snapshots.length - 1].date.getFullYear();
  const spanYears = lastYear - firstYear;
  if (spanYears < 2) return {};

  const firstLabelOfYear = new Map<number, string>();
  const yearOfLabel = new Map<string, number>();
  for (const snap of snapshots) {
    const year = snap.date.getFullYear();
    if (!firstLabelOfYear.has(year)) firstLabelOfYear.set(year, snap.label);
    yearOfLabel.set(snap.label, year);
  }

  const step = Math.ceil(spanYears / 8);
  const ticks: string[] = [];
  for (let year = firstYear; year <= lastYear; year += step) {
    const label = firstLabelOfYear.get(year);
    if (label !== undefined) ticks.push(label);
  }

  return {
    ticks,
    tickFormatter: (label: string) => {
      const year = yearOfLabel.get(label);
      return year === undefined ? label : String(year);
    },
  };
}
