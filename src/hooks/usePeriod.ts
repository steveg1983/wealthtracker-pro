import { useCallback, useMemo, useRef, useState } from 'react';
import { preferences, type PreferenceStorage } from '../services/preferencesService';

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
  /**
   * The window a DRILL-DOWN arrived asking for — the one the chart it was
   * clicked on was read over (see utils/reportDrillLink).
   *
   * It outranks any surface default, because the user chose it a click ago on
   * the card they came from, and it is deliberately NOT persisted: they were
   * looking at something, not changing their mind about which window this page
   * opens on. Leave the page and the stored period is exactly as they last set
   * it; touch the picker while here and that IS a choice, persisted as usual.
   */
  applyArrivalPeriod: (key: PeriodKey, customStart?: string, customEnd?: string) => void;
}

/**
 * Where a period selection is kept.
 *
 * An adapter rather than `localStorage` directly, because the answer to "which
 * window does the dashboard open on?" belongs to the USER, not to the machine
 * they happen to be sitting at — a restored backup that brought the accounts
 * back but reset every period to this-month is the complaint this exists to
 * fix. The default is the preferences document, which travels; the parameter is
 * here so a test can hold it still without touching global storage.
 *
 * `Storage`-shaped on purpose: the four keys per surface are written as the
 * same strings they always were, so nothing about the stored VALUES changed —
 * only where they live.
 */
export type PeriodStorage = PreferenceStorage;

/** Where the "the user picked this themselves" flag lives, per surface. */
const explicitStorageKey = (storageKey: string): string => `${storageKey}Explicit`;

/** Storage holds whatever an older build (or the user) put there. */
const isPeriodKey = (value: string): value is PeriodKey => value in PERIOD_LABELS;

interface PeriodSelection {
  period: PeriodKey;
  explicit: boolean;
}

/*
 * `seedPeriodSelection` was here: it carried a stored selection over to a
 * second key the first time that key was read, so SPLITTING one period control
 * into two did not silently reset half of an existing choice. Its only caller
 * was the Dashboard, whose three period controls have since been collapsed back
 * into one page-level bar (DESIGN_PASS_2026-08 §3.4) — and that merge keeps the
 * original storage key rather than introducing a new one, so there is nothing
 * left to seed. Deleted with its caller rather than left as an export nobody
 * imports.
 */

function readStoredSelection(
  storageKey: string,
  defaultKey: PeriodKey,
  storage: PeriodStorage
): PeriodSelection {
  const stored = storage.getItem(storageKey);
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
  const flag = storage.getItem(explicitStorageKey(storageKey));
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
export function usePeriod(
  storageKey: string,
  defaultKey: PeriodKey = 'this-month',
  storage: PeriodStorage = preferences
): UsePeriodResult {
  const [selection, setSelection] = useState<PeriodSelection>(() => readStoredSelection(storageKey, defaultKey, storage));
  const [customStart, setCustomStart] = useState<string>(() => storage.getItem(`${storageKey}CustomStart`) ?? '');
  const [customEnd, setCustomEnd] = useState<string>(() => storage.getItem(`${storageKey}CustomEnd`) ?? '');
  const { period, explicit } = selection;

  const persist = useCallback((key: PeriodKey, isExplicit: boolean) => {
    storage.setItem(storageKey, key);
    storage.setItem(explicitStorageKey(storageKey), String(isExplicit));
  }, [storageKey, storage]);

  const setPeriod = useCallback((key: PeriodKey) => {
    setSelection({ period: key, explicit: true });
    persist(key, true);
  }, [persist]);

  /**
   * Whether a drill-down brought its own window with it.
   *
   * A ref rather than the `explicit` flag below, because the two are read in
   * the SAME commit: the hub asks for the report's preferred window from one
   * effect and applies the arrival from another, and both callbacks closed over
   * the same `explicit: false`. Whichever effect React happened to run second
   * would win, which is a coin toss dressed as a rule. The ref is written
   * synchronously, so the arrival wins whatever the order.
   */
  const arrivedRef = useRef(false);

  const applyDefaultPeriod = useCallback((key: PeriodKey) => {
    // A choice the user made — or one a drill-down brought with it — outranks
    // any surface's preference, and re-applying the window already showing
    // would only churn the reports below it.
    if (arrivedRef.current || explicit || period === key) return;
    setSelection({ period: key, explicit: false });
    persist(key, false);
  }, [explicit, period, persist]);

  const applyArrivalPeriod = useCallback((
    key: PeriodKey,
    arrivalStart: string = '',
    arrivalEnd: string = ''
  ) => {
    arrivedRef.current = true;
    // Explicit in memory, so no report's preferred window can undo it while the
    // user is here — but nothing is written to storage. That asymmetry is the
    // whole feature: the visit borrows a window, the preference keeps its own.
    setSelection({ period: key, explicit: true });
    // Bounds only when a custom window arrived; otherwise whatever the user had
    // stored stays, ready if they pick Custom themselves.
    if (key === 'custom') {
      setCustomStart(arrivalStart);
      setCustomEnd(arrivalEnd);
    }
  }, []);

  // Editing the bounds of a custom range is as deliberate as picking one.
  const setCustomStartPersisted = useCallback((v: string) => {
    setCustomStart(v);
    storage.setItem(`${storageKey}CustomStart`, v);
    setSelection({ period, explicit: true });
    persist(period, true);
  }, [storageKey, storage, persist, period]);

  const setCustomEndPersisted = useCallback((v: string) => {
    setCustomEnd(v);
    storage.setItem(`${storageKey}CustomEnd`, v);
    setSelection({ period, explicit: true });
    persist(period, true);
  }, [storageKey, storage, persist, period]);

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
    applyArrivalPeriod,
  };
}
