import { useCallback, useState } from 'react';
import { preferences } from '../services/preferencesService';

export interface CumulativeReportToggle {
  /** True when the report should read as running totals for the period. */
  cumulative: boolean;
  setCumulative: (next: boolean) => void;
}

/**
 * The "Cumulative" reading of a month-by-month report, persisted PER REPORT
 * (each passes its own storage key) — unlike the shared period and account
 * filter, how one report is best read says nothing about the next.
 */
export function useCumulativeReport(storageKey: string): CumulativeReportToggle {
  const [cumulative, setCumulativeState] = useState<boolean>(
    () => preferences.getItem(storageKey) === '1'
  );

  const setCumulative = useCallback((next: boolean) => {
    setCumulativeState(next);
    preferences.setItem(storageKey, next ? '1' : '0');
  }, [storageKey]);

  return { cumulative, setCumulative };
}
