import { useCallback, useMemo, useState } from 'react';

/**
 * The app-wide reporting period — ONE definition of every window so no two
 * surfaces can disagree about what "last month" means (they previously
 * ranged over rolling-30-days, calendar month and all-time while using the
 * same words).
 *
 * 'tax-year' is the UK tax year: 6 April to 5 April.
 */
export type PeriodKey = 'this-month' | 'last-month' | 'tax-year' | 'last-12-months' | 'all' | 'custom';

export interface PeriodRange {
  /** Inclusive start, or null for unbounded (All time). */
  from: Date | null;
  /** Inclusive end, or null for unbounded. */
  to: Date | null;
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'tax-year': 'Tax year',
  'last-12-months': '12 months',
  all: 'All time',
  custom: 'Custom',
};

const endOfDay = (d: Date): Date => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};

/** Resolve a period key (+ custom bounds) to concrete dates. */
export function resolvePeriod(
  key: PeriodKey,
  customStart: string,
  customEnd: string,
  now: Date = new Date()
): PeriodRange {
  switch (key) {
    case 'this-month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case 'last-month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from, to };
    }
    case 'tax-year': {
      // UK tax year starts 6 April.
      const startYear = now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6)
        ? now.getFullYear()
        : now.getFullYear() - 1;
      return { from: new Date(startYear, 3, 6), to: null };
    }
    case 'last-12-months': {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from, to: null };
    }
    case 'all':
      return { from: null, to: null };
    case 'custom':
      return {
        from: customStart ? new Date(customStart) : null,
        to: customEnd ? endOfDay(new Date(customEnd)) : null,
      };
  }
}

export interface UsePeriodResult {
  period: PeriodKey;
  setPeriod: (key: PeriodKey) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (v: string) => void;
  setCustomEnd: (v: string) => void;
  range: PeriodRange;
  /** True when the date falls inside the current range (inclusive). */
  inRange: (date: Date | string) => boolean;
}

/**
 * Period selection persisted per surface (storageKey), defaulting to
 * this-month. All consumers get identical window semantics.
 */
export function usePeriod(storageKey: string, defaultKey: PeriodKey = 'this-month'): UsePeriodResult {
  const [period, setPeriodState] = useState<PeriodKey>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored && stored in PERIOD_LABELS ? (stored as PeriodKey) : defaultKey;
  });
  const [customStart, setCustomStart] = useState<string>(() => localStorage.getItem(`${storageKey}CustomStart`) ?? '');
  const [customEnd, setCustomEnd] = useState<string>(() => localStorage.getItem(`${storageKey}CustomEnd`) ?? '');

  const setPeriod = useCallback((key: PeriodKey) => {
    setPeriodState(key);
    localStorage.setItem(storageKey, key);
  }, [storageKey]);

  const setCustomStartPersisted = useCallback((v: string) => {
    setCustomStart(v);
    localStorage.setItem(`${storageKey}CustomStart`, v);
  }, [storageKey]);

  const setCustomEndPersisted = useCallback((v: string) => {
    setCustomEnd(v);
    localStorage.setItem(`${storageKey}CustomEnd`, v);
  }, [storageKey]);

  const range = useMemo(
    () => resolvePeriod(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const inRange = useCallback((date: Date | string) => {
    const time = new Date(date).getTime();
    if (range.from && time < range.from.getTime()) return false;
    if (range.to && time > range.to.getTime()) return false;
    return true;
  }, [range]);

  return {
    period,
    setPeriod,
    customStart,
    customEnd,
    setCustomStart: setCustomStartPersisted,
    setCustomEnd: setCustomEndPersisted,
    range,
    inRange,
  };
}
