/**
 * HOW THE RECONCILIATION LIST IS BANDED — the Accounts page's answer, applied
 * to reconciliation summaries.
 *
 * This page used to hold its own `useState<'type' | 'institution'>`: two
 * buttons that looked exactly like the Accounts page's pair but behaved as an
 * either/or, so turning Institution on turned Account Type off. The owner found
 * it by trying to do what the other page lets him do — "I cannot sort the
 * reconciliation page by account type AND Institution, its one or the other,
 * unlike in Accounts where you can set them both to 'ON'." Two identical
 * controls with different behaviour is exactly what P7 (one control set)
 * forbids.
 *
 * So the banding decision is not made here at all. `groupAccountsForDisplay` in
 * `utils/accountGrouping` decides it for both pages — all four switch
 * combinations, the institution catch-all, the case-insensitive institution
 * matching, the section order — and this module does nothing but carry
 * reconciliation summaries through it and hand back the same shape wearing
 * their names. Nothing about grouping can drift between the two pages, because
 * there is only one implementation of it.
 */
import {
  groupAccountsForDisplay,
  parseAccountGroupingPreference,
  serializeAccountGroupingPreference,
  DEFAULT_ACCOUNT_GROUPING,
  type AccountGroupingOptions,
  type GroupableAccount,
} from '../../utils/accountGrouping';
import { preferences } from '../../services/preferencesService';
import type { ReconciliationSummary } from '../../hooks/useReconciliation';

/**
 * This page's own switches — deliberately NOT the Accounts page's key.
 *
 * The two screens answer different questions. Accounts is a portfolio read, and
 * the owner keeps it banded the way he thinks about his money; reconciliation
 * is a worklist, and the useful banding there is whichever one makes the next
 * statement easy to find. Sharing one stored value would mean grouping the
 * worklist by institution silently re-banded the portfolio, which is a page
 * changing under the user because he touched a different page.
 *
 * Versioned for the same reason `accountsGroupBy` was: v1 held a single
 * either/or string, and it is still read once so an existing view survives.
 */
export const RECONCILIATION_GROUPING_STORAGE_KEY = 'reconciliationGroupBy.v2';
/** The pre-toggle key: `'type'` or `'institution'`, one or the other. */
export const LEGACY_RECONCILIATION_GROUPING_STORAGE_KEY = 'reconciliationGroupBy';

/** An institution sub-band inside a type section — present only with both switches on. */
export interface ReconciliationSubGroup {
  /** Stable React key and heading: the institution as first spelled. */
  label: string;
  title: string;
  summaries: ReconciliationSummary[];
}

/** One band of the list: its heading, everything in it, and its sub-bands if any. */
export interface ReconciliationGroup {
  /** The section type ('current') or the institution name — unique within a grouping. */
  label: string;
  title: string;
  /**
   * Every summary in the band. With sub-bands present the ROWS are drawn from
   * `subGroups`; this stays whole because the heading's count describes the
   * band, exactly as the Accounts page's band heading does.
   */
  summaries: ReconciliationSummary[];
  subGroups?: ReconciliationSubGroup[];
}

/**
 * Flat carries no heading, no count and no band chrome, so it is its own shape
 * rather than one nameless group — the list cannot accidentally head it.
 */
export type ReconciliationGrouping =
  | { mode: 'flat'; summaries: ReconciliationSummary[] }
  | { mode: 'grouped'; groups: ReconciliationGroup[] };

/**
 * A summary wearing the three fields the shared grouper reads, with the summary
 * itself along for the ride. Structural typing is what makes this free:
 * `GroupableAccount` asks for a name, a type and an institution, and asks for
 * nothing about where they came from.
 */
interface GroupableSummary extends GroupableAccount {
  summary: ReconciliationSummary;
}

const groupable = (summary: ReconciliationSummary): GroupableSummary => ({
  name: summary.account.name,
  type: summary.account.type,
  institution: summary.account.institution,
  summary,
});

const unwrap = (rows: readonly GroupableSummary[]): ReconciliationSummary[] =>
  rows.map(row => row.summary);

/**
 * Band the summaries the way the Accounts page bands accounts.
 *
 * `sortSummaries` is applied to the INNERMOST list every time — the rows a user
 * actually reads down — which is why it is the caller's to supply: the shared
 * grouper deliberately preserves input order so each page can impose its own
 * Default/Name/Value sort. With both switches on that means sorting inside each
 * institution sub-band, not inside the type section that contains them.
 */
export function groupReconciliationSummaries(
  summaries: readonly ReconciliationSummary[],
  options: AccountGroupingOptions,
  sortSummaries: (list: ReconciliationSummary[]) => ReconciliationSummary[]
): ReconciliationGrouping {
  const grouped = groupAccountsForDisplay(summaries.map(groupable), options);

  if (grouped.mode === 'flat') {
    return { mode: 'flat', summaries: sortSummaries(unwrap(grouped.accounts)) };
  }

  return {
    mode: 'grouped',
    groups: grouped.groups.map(group => ({
      label: group.label,
      title: group.title,
      summaries: sortSummaries(unwrap(group.accounts)),
      ...(group.subGroups
        ? {
            subGroups: group.subGroups.map(sub => ({
              label: sub.label,
              title: sub.title,
              summaries: sortSummaries(unwrap(sub.accounts)),
            })),
          }
        : {}),
    })),
  };
}

/**
 * Both switches as stored, through the SHARED parser — so the migration from
 * the single either/or ('institution' → institution only, anything else → type
 * only) is the one the Accounts page already proved, rather than a second
 * reading of the same idea.
 *
 * The legacy value is read from preferences rather than from `localStorage`
 * (which is where the Accounts page has to look for its own): this page's key
 * has travelled with the account since it was introduced, so that is where an
 * existing choice actually is.
 *
 * Preferences can throw outright, which must never stop the list rendering.
 */
export function readStoredReconciliationGrouping(): AccountGroupingOptions {
  try {
    return parseAccountGroupingPreference(
      preferences.getItem(RECONCILIATION_GROUPING_STORAGE_KEY),
      preferences.getItem(LEGACY_RECONCILIATION_GROUPING_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_ACCOUNT_GROUPING;
  }
}

/** Remember both switches. A storage failure loses the memory, never the view. */
export function writeReconciliationGrouping(options: AccountGroupingOptions): void {
  try {
    preferences.setItem(
      RECONCILIATION_GROUPING_STORAGE_KEY,
      serializeAccountGroupingPreference(options)
    );
  } catch {
    /* storage unavailable — the switches still work for this session */
  }
}
