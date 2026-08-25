import { useCallback, useMemo, useState } from 'react';
import { PERIOD_LABELS, type UsePeriodResult } from './usePeriod';
import {
  clearReportPeriodDefault,
  matchesReportPeriodDefault,
  readReportPeriodDefault,
  writeReportPeriodDefault,
} from '../utils/reportPeriodDefaults';

/**
 * The "always open this report on this window" control's whole state.
 *
 * A hook rather than two copies of the same six lines, because there are two
 * places a period control can live: the hub renders one above most reports,
 * and the net-worth report owns its own inside the chart card (the registry's
 * `ownsPeriodBar` — Design, 22 Aug). Both need the identical answer to "is
 * what I am looking at the saved default", and a second hand-rolled copy is
 * how the two would come to disagree.
 *
 * `isDefault` is DERIVED, never stored — which is what makes the owner's
 * "the button unticks itself" true without anything implementing unticking.
 */
export function useReportPeriodDefault(
  reportId: string,
  picker: Pick<UsePeriodResult, 'period' | 'customStart' | 'customEnd'>
): {
  isDefault: boolean;
  /** The window's own name, so the control can say what it would save. */
  periodLabel: string;
  save: () => void;
  clear: () => void;
} {
  // Bumped on write, so the derived answer re-reads what is actually stored
  // rather than trusting a copy this hook made earlier.
  const [version, setVersion] = useState(0);

  const saved = useMemo(
    () => readReportPeriodDefault(reportId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportId, version]
  );

  const save = useCallback(() => {
    writeReportPeriodDefault(reportId, {
      period: picker.period,
      customStart: picker.customStart,
      customEnd: picker.customEnd,
    });
    setVersion(v => v + 1);
  }, [reportId, picker.period, picker.customStart, picker.customEnd]);

  const clear = useCallback(() => {
    clearReportPeriodDefault(reportId);
    setVersion(v => v + 1);
  }, [reportId]);

  return {
    isDefault: matchesReportPeriodDefault(saved, picker),
    periodLabel: PERIOD_LABELS[picker.period].toLowerCase(),
    save,
    clear,
  };
}
