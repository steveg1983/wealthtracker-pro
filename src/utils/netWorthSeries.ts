import type { Account, Transaction } from '../types';
import { toDecimal, type DecimalInstance } from './decimal';
import { resolveEffectiveOpeningDates } from './openingDates';
import type { PeriodRange } from '../hooks/usePeriod';
import { getDateLocale } from '../utils/dateFormatter';

/**
 * How foreign-currency accounts join a net-worth sum (Claude Design, 22 Aug
 * §1 — and the finding underneath it: the walk was summing every account's
 * NATIVE units as display-currency units, so a dollar account's balance
 * counted as that many pounds. The dashboard's summary converts; this series
 * did not, and the two could disagree by the whole unconverted delta).
 *
 * `factors` multiplies an account's native balance into the display currency
 * at TODAY'S rates — which is a real decision for a historic series, and the
 * caller's provenance line must say it: yesterday's balance at today's rate,
 * because the app holds no historical rate table. An account with no factor
 * (its currency has no rate) counts UNCONVERTED, exactly as the summary's
 * ConvertedTotalNote already reports that state — wrong by however much it
 * was worth, and said out loud rather than guessed at parity.
 */
export interface NetWorthConversion {
  /** Multiplier into the display currency, per account id. Absent = native. */
  factors: Map<string, DecimalInstance>;
  /** Currency codes with no rate: their amounts counted unconverted. */
  unconverted: string[];
}

/** Build the per-account factors from a units-per-GBP rate table. */
export function buildNetWorthConversion(
  accounts: readonly Pick<Account, 'id' | 'currency'>[],
  rates: Record<string, number>,
  displayCurrency: string
): NetWorthConversion {
  const factors = new Map<string, DecimalInstance>();
  const unconverted = new Set<string>();
  const displayRate = rates[displayCurrency];
  for (const account of accounts) {
    const currency = account.currency || displayCurrency;
    if (currency === displayCurrency) continue;
    const accountRate = rates[currency];
    if (!accountRate || !displayRate) {
      unconverted.add(currency);
      continue;
    }
    // The table is units per GBP, so A→B is rates[B]/rates[A]; GBP is only
    // the pivot — the same arithmetic useFxQuote documents.
    factors.set(account.id, toDecimal(displayRate).dividedBy(toDecimal(accountRate)));
  }
  return { factors, unconverted: [...unconverted].sort() };
}

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
/**
 * Per-DATE conversion: each snapshot converts at its own day's rates (the
 * owner's backdated-rates ask, 22 Aug — a 2017 balance at 2017's rate). The
 * static NetWorthConversion remains for callers valuing everything at one
 * day's rates; the walk takes either.
 */
export interface NetWorthConversionByDate {
  /** The factors in force on `date` — that day's reference rates. */
  at(date: Date): NetWorthConversion | null;
  /** Currencies with no history at all — counted native and reported. */
  unconverted: readonly string[];
}

/** 'YYYY-MM-DD' → local Date, never the ISO/UTC parse that moves a boundary. */
const dayKeyToDate = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * A per-day factor lookup over a dated conversion, memoised by day — the
 * walks that consume it ask for the same day once per account. Identity
 * (always null) when no seam is passed, so callers keep one code path.
 */
export const dailyFactorLookup = (
  conversionAt: ((date: Date) => NetWorthConversion | null) | undefined
): ((accountId: string, day: string) => DecimalInstance | null) => {
  if (!conversionAt) return () => null;
  const byDay = new Map<string, ReadonlyMap<string, DecimalInstance> | null>();
  return (accountId, day) => {
    let factors = byDay.get(day);
    if (factors === undefined) {
      factors = conversionAt(dayKeyToDate(day))?.factors ?? null;
      byDay.set(day, factors);
    }
    return factors?.get(accountId) ?? null;
  };
};

const isDatedConversion = (
  c: NetWorthConversion | NetWorthConversionByDate
): c is NetWorthConversionByDate => typeof (c as NetWorthConversionByDate).at === 'function';

export function buildNetWorthSnapshots(
  accounts: Account[],
  transactions: Transaction[],
  range: PeriodRange,
  now: Date = new Date(),
  conversion?: NetWorthConversion | NetWorthConversionByDate,
  /**
   * The investment valuation term (slice 3b): what an account's open
   * positions are worth on a day beyond their pooled cost, in the account's
   * NATIVE currency — see buildInvestmentValuation. Applied per account per
   * point BEFORE conversion, so a valued balance rides the same rate as the
   * ledger balance it sits on. Omitted, every figure is exactly what it
   * always was — pure ledger.
   */
  investmentDeltaAt?: (accountId: string, day: string) => DecimalInstance
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
    // Into the display currency where a factor exists; native (and reported
    // by the caller as unconverted) where it does not. Balances stay native
    // through the walk — the transactions are native — and convert only at
    // the summing, so one rate refresh never has to replay the history. A
    // dated conversion resolves THIS point's factors: the day's own rates.
    const active = conversion === undefined
      ? undefined
      : isDatedConversion(conversion) ? conversion.at(point) ?? undefined : conversion;
    const pointDay = investmentDeltaAt === undefined ? '' : netWorthPointToken(point);
    for (const [accountId, native] of balances.entries()) {
      // Ledger plus the derived valuation term, in native units — then one
      // conversion for the whole valued balance.
      const valued = investmentDeltaAt === undefined
        ? native
        : native.plus(investmentDeltaAt(accountId, pointDay));
      const factor = active?.factors.get(accountId);
      const b = factor ? valued.times(factor) : valued;
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
