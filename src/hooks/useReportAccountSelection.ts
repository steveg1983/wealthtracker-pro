import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { ReportAccountScope } from './useReportDataset';

/** Where every report remembers which accounts it covers: a JSON array of ids. */
const STORAGE_KEY = 'reportsAccountFilterIds';
/**
 * The retired one-or-all dropdown's key ('all', or a single account id). It is
 * READ once, so a choice made before every report went multi-select survives
 * the upgrade, and cleared the first time this control writes — nothing
 * produces it any more, and a stale id must not outrank a real subset.
 */
const LEGACY_STORAGE_KEY = 'reportsAccountFilter';

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
  /**
   * Apply a whole draft at once — the multi-select's Save button. A draft
   * covering every account collapses to the 'all' sentinel, same rule as
   * ticking the last box back on via toggle.
   */
  replace: (ids: ReadonlySet<string>) => void;
}

/** Storage holds whatever an older build (or the user) put there. */
function readStoredIds(): ReadonlySet<string> | null {
  const stored = localStorage.getItem(STORAGE_KEY);
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
  const stored = readStoredIds();
  if (stored !== null) return stored;
  // Nothing of this control's own — honour the retired dropdown's last answer
  // rather than silently widening the report back out to every account.
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  return legacy !== null && legacy !== 'all' ? new Set([legacy]) : 'all';
}

/**
 * The reports' account filter: a SET of accounts, shared by every report in
 * the gallery and persisted, so moving between reports keeps BOTH halves of
 * the question ("which money, over what window") rather than resetting one.
 *
 * 'all' is stored as the ABSENCE of a key, never as an enumerated list — a
 * report showing every account must keep showing every account when a new one
 * is opened.
 */
export function useReportAccountSelection(): ReportAccountSelection {
  const { accounts } = useApp();
  const [selection, setSelection] = useState<Selection>(readStoredSelection);

  const accountIds = useMemo(() => accounts.map(account => account.id), [accounts]);

  const apply = useCallback((next: Selection) => {
    setSelection(next);
    // Whatever the retired dropdown left behind is now answered for.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (next === 'all') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
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
  const replace = useCallback((ids: ReadonlySet<string>) => {
    apply(accountIds.length > 0 && ids.size === accountIds.length && accountIds.every(id => ids.has(id))
      ? 'all'
      : new Set(ids));
  }, [accountIds, apply]);

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
    replace,
  };
}
