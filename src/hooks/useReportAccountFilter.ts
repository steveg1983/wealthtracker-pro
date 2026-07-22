import { useCallback, useState } from 'react';

const STORAGE_KEY = 'reportsAccountFilter';

export interface ReportAccountFilter {
  /** An account id, or 'all'. */
  accountId: string;
  setAccountId: (id: string) => void;
}

/**
 * The reports' account filter, persisted like the shared period — so moving
 * between reports in the gallery keeps BOTH halves of the question ("which
 * money, over what window") rather than silently resetting one of them.
 */
export function useReportAccountFilter(): ReportAccountFilter {
  const [accountId, setAccountIdState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'all'
  );

  const setAccountId = useCallback((id: string) => {
    setAccountIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { accountId, setAccountId };
}
