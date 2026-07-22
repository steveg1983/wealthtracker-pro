import type { Account, Transaction } from '../types';
import { toDecimal } from './decimal';
import type { PeriodRange } from '../hooks/usePeriod';

export interface NetWorthSnapshot {
  date: Date;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

/**
 * Net worth over time from first principles: per-account running balance
 * (opening balance + cumulative transactions, Decimal throughout) snapshotted
 * at each point in the period. One forward walk — balances accumulate from
 * the very beginning, so a point inside the window carries ALL history
 * before it. Shared by the Net Worth report and the Dashboard's pinned
 * net-worth widget.
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

  const balances = new Map(accounts.map(a => [a.id, toDecimal(a.openingBalance ?? 0)]));
  const monthly = spanDays > 92;
  let i = 0;
  const out: NetWorthSnapshot[] = [];
  for (const point of points) {
    const cutoff = new Date(point);
    cutoff.setHours(23, 59, 59, 999);
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
      label: point.toLocaleDateString('en-GB', monthly
        ? { month: 'short', year: '2-digit' }
        : { day: '2-digit', month: 'short' }),
      assets: assets.toNumber(),
      liabilities: liabilities.toNumber(),
      netWorth: assets.minus(liabilities).toNumber(),
    });
  }
  return out;
}
