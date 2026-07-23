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
  /**
   * True when the current period is the user's own choice rather than a
   * default this surface applied for them. A choice is never overridden.
   */
  isExplicit: boolean;
  /**
   * Ask for a surface's preferred period. Honoured only while the user has
   * made no choice of their own, and never counts as a choice itself.
   */
  applyDefaultPeriod: (key: PeriodKey) => void;
}

/** Where the "the user picked this themselves" flag lives, per surface. */
const explicitStorageKey = (storageKey: string): string => `${storageKey}Explicit`;

/** Storage holds whatever an older build (or the user) put there. */
const isPeriodKey = (value: string): value is PeriodKey => value in PERIOD_LABELS;

interface PeriodSelection {
  period: PeriodKey;
  explicit: boolean;
}

function readStoredSelection(storageKey: string, defaultKey: PeriodKey): PeriodSelection {
  const stored = localStorage.getItem(storageKey);
  if (stored === null || !isPeriodKey(stored)) return { period: defaultKey, explicit: false };

  // Only a value this build flagged is a choice this build can trust.
  //
  // The flag postdates the period itself, and it is tempting to reason that an
  // older build wrote the key only from the picker, so an unflagged value must
  // be a deliberate choice. That is true about where the value came from and
  // wrong about what it meant: it was chosen for ONE tabbed reports page, and
  // reading it as a standing instruction makes it outrank the preferred window
  // of eight reports that did not exist when it was set — so every returning
  // user opens "Net worth over time" on last month's dot, permanently, and the
  // preference never gets a chance to apply. Found by opening the page; the
  // tests could not see it, because they start from an empty localStorage.
  //
  // So an unflagged value is treated as a default, not a decision: the report's
  // window applies, and the next period the user picks is flagged and honoured
  // for good. The cost is one reset, once, for someone who had chosen before.
  const flag = localStorage.getItem(explicitStorageKey(storageKey));
  if (flag !== 'true') return { period: defaultKey, explicit: false };
  return { period: stored, explicit: true };
}

/**
 * Period selection persisted per surface (storageKey), defaulting to
 * this-month. All consumers get identical window semantics.
 *
 * `defaultKey` is read once, when the surface mounts. To change the default
 * afterwards — as the reports hub does when a report with its own preferred
 * window opens — call `applyDefaultPeriod`.
 */
export function usePeriod(storageKey: string, defaultKey: PeriodKey = 'this-month'): UsePeriodResult {
  const [selection, setSelection] = useState<PeriodSelection>(() => readStoredSelection(storageKey, defaultKey));
  const [customStart, setCustomStart] = useState<string>(() => localStorage.getItem(`${storageKey}CustomStart`) ?? '');
  const [customEnd, setCustomEnd] = useState<string>(() => localStorage.getItem(`${storageKey}CustomEnd`) ?? '');
  const { period, explicit } = selection;

  const persist = useCallback((key: PeriodKey, isExplicit: boolean) => {
    localStorage.setItem(storageKey, key);
    localStorage.setItem(explicitStorageKey(storageKey), String(isExplicit));
  }, [storageKey]);

  const setPeriod = useCallback((key: PeriodKey) => {
    setSelection({ period: key, explicit: true });
    persist(key, true);
  }, [persist]);

  const applyDefaultPeriod = useCallback((key: PeriodKey) => {
    // A choice the user made outranks any surface's preference, and re-applying
    // the window already showing would only churn the reports below it.
    if (explicit || period === key) return;
    setSelection({ period: key, explicit: false });
    persist(key, false);
  }, [explicit, period, persist]);

  // Editing the bounds of a custom range is as deliberate as picking one.
  const setCustomStartPersisted = useCallback((v: string) => {
    setCustomStart(v);
    localStorage.setItem(`${storageKey}CustomStart`, v);
    setSelection({ period, explicit: true });
    persist(period, true);
  }, [storageKey, persist, period]);

  const setCustomEndPersisted = useCallback((v: string) => {
    setCustomEnd(v);
    localStorage.setItem(`${storageKey}CustomEnd`, v);
    setSelection({ period, explicit: true });
    persist(period, true);
  }, [storageKey, persist, period]);

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
    isExplicit: explicit,
    applyDefaultPeriod,
  };
}
