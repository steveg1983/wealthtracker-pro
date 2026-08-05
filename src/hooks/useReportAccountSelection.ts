import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { ReportAccountScope } from './useReportDataset';

/** The cross-report channel: 'all', or ONE account id (see useReportAccountFilter). */
const STORAGE_KEY = 'reportsAccountFilter';
/** This control's own channel: the explicit subset, as a JSON array of ids. */
const IDS_STORAGE_KEY = 'reportsAccountFilterIds';

/**
 * 'all' is a sentinel, never an enumerated list: a report showing every
 * account must keep showing every account when a new one is opened.
 */
type Selection = 'all' | ReadonlySet<string>;

export interface ReportAccountSelection {
  /** Hand straight to `useReportDataset` — it filters on exactly this. */
  scope: ReportAccountScope;
  /** True when every account is included, including any added later. */
  isAll: boolean;
  /** The accounts actually included — resolved, so 'all' is spelled out. */
  selectedIds: ReadonlySet<string>;
  isSelected: (accountId: string) => boolean;
  toggle: (accountId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

/** Storage holds whatever an older build (or the user) put there. */
function readStoredIds(): ReadonlySet<string> | null {
  const stored = localStorage.getItem(IDS_STORAGE_KEY);
  if (stored === null) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === 'string')) {
      return new Set(parsed);
    }
  } catch {
    // Unparseable means unusable — fall back to every account.
  }
  return null;
}

function readStoredSelection(): Selection {
  // A single-account choice is the one thing EVERY report can express, so a
  // named account in the shared key is the most recent statement of intent
  // and outranks a subset this control stored earlier.
  const single = localStorage.getItem(STORAGE_KEY);
  if (single !== null && single !== 'all') return new Set([single]);
  return readStoredIds() ?? 'all';
}

/**
 * The reports' account filter as a SET of accounts rather than one-or-all,
 * persisted exactly like the single-account filter it generalises.
 *
 * Both keys are written on every change so the two controls cannot drift: a
 * subset writes 'all' to the shared key, because the reports that still offer
 * one-or-all would otherwise read a single id as a choice the user never made.
 */
export function useReportAccountSelection(): ReportAccountSelection {
  const { accounts } = useApp();
  const [selection, setSelection] = useState<Selection>(readStoredSelection);

  const accountIds = useMemo(() => accounts.map(account => account.id), [accounts]);

  const apply = useCallback((next: Selection) => {
    setSelection(next);
    if (next === 'all') {
      localStorage.setItem(STORAGE_KEY, 'all');
      localStorage.removeItem(IDS_STORAGE_KEY);
      return;
    }
    const ids = [...next];
    localStorage.setItem(STORAGE_KEY, ids.length === 1 ? ids[0] : 'all');
    localStorage.setItem(IDS_STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const toggle = useCallback((accountId: string) => {
    const next = new Set(selection === 'all' ? accountIds : selection);
    if (next.has(accountId)) {
      next.delete(accountId);
    } else {
      next.add(accountId);
    }
    // Ticking the last box back on means "all accounts", not "these five" —
    // otherwise the next account opened would silently be left out.
    apply(accountIds.length > 0 && next.size === accountIds.length ? 'all' : next);
  }, [selection, accountIds, apply]);

  const selectAll = useCallback(() => apply('all'), [apply]);
  const deselectAll = useCallback(() => apply(new Set<string>()), [apply]);

  const selectedIds = useMemo(
    () => (selection === 'all' ? new Set(accountIds) : selection),
    [selection, accountIds]
  );

  const isSelected = useCallback(
    (accountId: string) => selection === 'all' || selection.has(accountId),
    [selection]
  );

  return {
    scope: selection,
    isAll: selection === 'all',
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
  };
}
