import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useToast } from '../../contexts/ToastContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import PageWrapper from '../../components/PageWrapper';
import { VirtualizedTable, type Column } from '../../components/VirtualizedTable';
import RenamePayeesModal from '../../components/RenamePayeesModal';
import DismissSuggestionPrompt from '../../components/sweeps/DismissSuggestionPrompt';
import DismissedPayeeSuggestions from '../../components/DismissedPayeeSuggestions';
import { SearchIcon, XIcon } from '../../components/icons';
import {
  summarisePayees,
  filterPayees,
  buildPayeeClusters,
  isPayeeSortField,
  orderClusters,
  sortPayees,
  withoutHiddenPayees,
  type ClusterOrder,
  type PayeeCluster,
  type PayeeSortField,
  type PayeeSummary,
} from '../../utils/payeeCleanup';
import {
  dismissedKeys,
  isPayeeDismissalKind,
  payeeHiddenDismissalKey,
  payeeLineDismissalKey,
  payeeMerchantDismissalKey,
} from '../../utils/suggestionDismissals';
import type { DismissalKind, SuggestionDismissal } from '../../types';

/**
 * Payee cleanup — one screen for the thousands of near-duplicate payees a
 * bank feed creates by baking a transaction reference into every description.
 *
 * The screen never decides anything. It counts, it suggests which payees look
 * like one merchant, renames exactly what the user ticked — and remembers the
 * suggestions they refused, so a guess that is wrong for their register is
 * wrong once rather than every time they open the page.
 */

/**
 * How tall the suggestions list is, in px, before it starts scrolling.
 *
 * A max-height rather than a height: with three suggestions the box is three
 * rows tall, and with three hundred it is this, so the screen never opens with
 * a pane of empty ruled lines. Chosen to cut the seventh row in half — a list
 * that ends mid-row is visibly a list with more in it, which a list ending
 * flush against a border is not.
 *
 * Every suggestion is rendered into it. The old screen showed the top eight of
 * an unstated total, which is what the owner reported: "when you tidy up one,
 * the next appears, so I don't really know how many different suggestions the
 * system is making."
 */
const SUGGESTION_LIST_MAX_HEIGHT = 224;

/**
 * How tall the payee list is, in px.
 *
 * A NUMBER on a wrapper, with `h-full` on the table inside it, and both halves
 * are load-bearing — see the comment on the table below. This is the same shape
 * the register uses (pages/AccountTransactions).
 */
const LIST_HEIGHT = 560;

const dateRange = (payee: PayeeSummary): string => {
  const format = (d: Date): string =>
    d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const from = format(payee.earliest);
  const to = format(payee.latest);
  return from === to ? from : `${from} – ${to}`;
};

/**
 * What the user has refused, from both places it can live: saved for good, and
 * refused a moment ago for this sitting only. One set, because the suggestion
 * has to disappear the instant it is refused, whichever answer follows.
 *
 * `saved` is added to in place — it is the fresh Set dismissedKeys just built,
 * never state held anywhere.
 */
const withSessionKeys = (saved: Set<string>, thisSitting: ReadonlySet<string>): Set<string> => {
  for (const key of thisSitting) saved.add(key);
  return saved;
};

/**
 * The orders, in the words of the question each one answers. "Most
 * transactions" is the order the screen has always used and still opens in —
 * the biggest win first, which is why the old eight chips showed what they
 * showed. The payee-count pair reads the same list by how far a merchant
 * fragmented, from either end; A–Z is "where is the one I came here for".
 */
const ORDERS: ReadonlyArray<{ value: ClusterOrder; label: string; hint: string }> = [
  {
    value: 'transactions',
    label: 'Most transactions',
    hint: 'Biggest tidy-up first',
  },
  {
    value: 'most-payees',
    label: 'Most payees',
    hint: 'Widest spread first',
  },
  {
    value: 'fewest-payees',
    label: 'Fewest payees',
    hint: 'Near-singletons first',
  },
  {
    value: 'alphabetical',
    label: 'A–Z',
    hint: 'By merchant name',
  },
];

interface SuggestionRowProps {
  cluster: PayeeCluster;
  active: boolean;
  onPick: (cluster: PayeeCluster) => void;
}

/**
 * One suggested merchant, as a row in the scrolling list.
 *
 * Memoised, and taking `active` as a boolean rather than reading the selected
 * key itself, so that picking a suggestion re-renders the two rows whose state
 * actually changed rather than all of them. That is the difference between a
 * list that stays instant at a few hundred suggestions and one that stutters
 * on every click.
 *
 * The counts are the reason to pick one before another — alphabetical order
 * makes a suggestion findable, it does not make it worth doing — so they are on
 * the row in both orders, not only when sorted by them.
 */
const SuggestionRow = React.memo(function SuggestionRow({
  cluster,
  active,
  onPick,
}: SuggestionRowProps): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(cluster)}
        aria-pressed={active}
        // ring-inset, because the row is flush to the sides of a box that
        // scrolls: an outset focus ring would be clipped by the overflow.
        className={`w-full flex items-baseline gap-3 px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
          active
            ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <span className="truncate font-medium" title={cluster.key}>{cluster.key}</span>
        <span
          className={`ml-auto shrink-0 tabular-nums ${
            active ? 'text-blue-800 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {cluster.members.length.toLocaleString()} payees ·{' '}
          {cluster.transactionCount.toLocaleString()} transactions
        </span>
      </button>
    </li>
  );
});

interface DismissPrompt {
  kind: DismissalKind;
  /**
   * One key per refusal to save: one for the two single-subject kinds, and one
   * per ticked payee when a selection is being taken off the page.
   */
  subjectKeys: string[];
  /** Reads mid-sentence: "Do you want … eliminated from this report in future?" */
  subject: string;
  /** What answering No leaves behind. */
  keepingMeans: string;
  /** Said once the refusal is saved — the consequence, not the count. */
  success: string;
  /**
   * What NOT saving means, in the future tense. Named per refusal because the
   * three consequences differ: a suggestion comes back as a suggestion, a
   * hidden payee comes back into the list.
   */
  ifNotSaved: string;
}

/**
 * A refusal the user made and the database would not take.
 *
 * Kept on the page rather than shouted once in a toast, because the payees it
 * is about have already left the list for this sitting: without this the screen
 * would look exactly as it does after a successful save, and the user would
 * find out it had not worked the next time they opened the page. It carries the
 * unsaved keys so Try again re-attempts precisely what failed.
 */
interface SaveFailure {
  kind: DismissalKind;
  /** Still unsaved — what Try again will attempt. */
  subjectKeys: string[];
  /** How many of the batch did save. */
  saved: number;
  ifNotSaved: string;
  success: string;
  /** Why, as the service reported it. */
  reason: string;
}

/** What one pass over a batch of refusals actually managed to write. */
interface SaveOutcome {
  saved: number;
  failedKeys: string[];
  reason: string;
}

/**
 * Why a save failed, in the words of whatever refused it.
 *
 * The database's own sentence, not a friendly paraphrase of it: a refusal this
 * screen cannot save is nearly always structural — a constraint that has not
 * been widened yet, a connection that is not there — and the exact wording is
 * what makes it fixable rather than mysterious.
 */
const reasonFrom = (error: unknown): string => {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return 'no reason given';
};

export default function PayeeCleanup(): React.JSX.Element {
  const {
    transactions,
    suggestionDismissals,
    suggestionDismissalsStatus,
    refreshSuggestionDismissals,
    dismissSuggestion,
    restoreSuggestion,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renameOpen, setRenameOpen] = useState(false);
  /** The merchant whose suggestion is being worked on, if any. */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  /**
   * Which order the suggestions are listed in. Not persisted: this page has no
   * saved-preference mechanism of its own, and the choice is a lens on one
   * sitting's work rather than a setting.
   */
  const [order, setOrder] = useState<ClusterOrder>('transactions');
  /**
   * Which column the payee list is ordered by.
   *
   * Opens on the busiest payees first — the order summarisePayees has always
   * returned and the one the screen has always shown, so nothing moves until a
   * header is clicked.
   */
  const [sortField, setSortField] = useState<PayeeSortField>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  /** Refused for this sitting only — the answer to "No, just this once". */
  const [sittingMerchants, setSittingMerchants] = useState<ReadonlySet<string>>(new Set());
  const [sittingLines, setSittingLines] = useState<ReadonlySet<string>>(new Set());
  const [sittingHidden, setSittingHidden] = useState<ReadonlySet<string>>(new Set());
  const [prompt, setPrompt] = useState<DismissPrompt | null>(null);
  const [savingDismissal, setSavingDismissal] = useState(false);
  /** How far through a batch the save is, for the button that is waiting on it. */
  const [savedSoFar, setSavedSoFar] = useState(0);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  // Read once when the page opens, the same as every sweep does: a refusal
  // saved on another device has to be honoured here too.
  useEffect(() => {
    void refreshSuggestionDismissals();
  }, [refreshSuggestionDismissals]);

  // One pass over every transaction, memoised on the array identity. Filtering
  // runs against the summaries (thousands) rather than the transactions (tens
  // of thousands), and the query is deferred so a keystroke never waits on the
  // filter — the list catches up a frame later instead of the field stuttering.
  const everyPayee = useMemo(() => summarisePayees(transactions), [transactions]);

  const refused = useMemo(() => ({
    merchants: withSessionKeys(
      dismissedKeys(suggestionDismissals, 'payee-merchant'), sittingMerchants
    ),
    lines: withSessionKeys(dismissedKeys(suggestionDismissals, 'payee-line'), sittingLines),
    hidden: withSessionKeys(dismissedKeys(suggestionDismissals, 'payee-hidden'), sittingHidden),
  }), [suggestionDismissals, sittingMerchants, sittingLines, sittingHidden]);

  /**
   * The payees this screen still has anything to say about.
   *
   * Hidden payees are dropped HERE, before the list, the suggestions and every
   * count are computed from it — so "off this page" means off all of it, and no
   * figure can go on counting something the user cannot see.
   */
  const payees = useMemo(
    () => withoutHiddenPayees(everyPayee, refused.hidden),
    [everyPayee, refused.hidden]
  );
  const hiddenCount = everyPayee.length - payees.length;

  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => filterPayees(payees, deferredQuery), [payees, deferredQuery]);
  /**
   * The same payees, in the order the header asked for.
   *
   * A separate array from `shown` on purpose: "Showing X of Y" and "select all
   * shown" are about WHICH payees are on screen, and re-ordering them changes
   * neither figure. Sorting the filtered list rather than the whole register
   * keeps the work proportional to what is actually being looked at.
   */
  const sortedShown = useMemo(
    () => sortPayees(shown, sortField, sortDirection),
    [shown, sortField, sortDirection]
  );

  const dismissalsChecked =
    suggestionDismissalsStatus === 'ready' || suggestionDismissalsStatus === 'error';

  /**
   * Every suggestion the screen still has to make — the list, and the number
   * the heading states.
   *
   * Built from `payees` (already minus the hidden ones) and `refused` (minus
   * the merchants and lines the user has struck off), so the count in the
   * heading cannot drift from the rows beneath it: they are the same array.
   */
  const allClusters = useMemo(() => buildPayeeClusters(payees, refused), [payees, refused]);
  const orderedClusters = useMemo(() => orderClusters(allClusters, order), [allClusters, order]);
  /**
   * What tidying every suggestion would do, which is the point of stating the
   * total at all: a number of groups on its own says how much work there is,
   * not what the work is worth.
   */
  const payeesInSuggestions = useMemo(
    () => allClusters.reduce((sum, cluster) => sum + cluster.members.length, 0),
    [allClusters]
  );
  const activeCluster = useMemo(
    () => allClusters.find(cluster => cluster.key === activeKey) ?? null,
    [allClusters, activeKey]
  );

  const payeeDismissals = useMemo(
    () => suggestionDismissals.filter(d => isPayeeDismissalKind(d.kind)),
    [suggestionDismissals]
  );

  /**
   * The payees the active suggestion is still made of — which is not the same
   * as "every payee whose text looks like this merchant", once one has been
   * left out. The row for a payee that has been left out stays in the list (a
   * refusal hides a suggestion, never a payee), and has to say so rather than
   * go on offering to leave out something already left out.
   */
  const activeMembers = useMemo(
    () => new Set((activeCluster?.members ?? []).map(m => m.description)),
    [activeCluster]
  );

  const selectedPayees = useMemo(
    () => payees.filter(p => selected.has(p.description)),
    [payees, selected]
  );
  const selectedTransactionCount = useMemo(
    () => selectedPayees.reduce((sum, p) => sum + p.count, 0),
    [selectedPayees]
  );

  const toggle = useCallback((description: string): void => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(description)) {
        next.delete(description);
      } else {
        next.add(description);
      }
      return next;
    });
  }, []);

  const untick = useCallback((descriptions: string[]): void => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const description of descriptions) next.delete(description);
      return next;
    });
  }, []);

  // ADDS the filtered payees to what is already ticked rather than replacing
  // it — a user who selects an Amazon batch, then searches "interest", must
  // not have the Amazon batch silently dropped by the next select-all.
  const selectAllShown = useCallback((): void => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const payee of shown) next.add(payee.description);
      return next;
    });
  }, [shown]);

  /**
   * A suggestion is a shortcut to a SELECTION, never to a rename: it narrows
   * the list to the cluster and ticks its members, so what is about to change
   * is on screen and can be un-ticked before anything is written.
   */
  const applyCluster = useCallback((cluster: PayeeCluster): void => {
    setQuery(cluster.key);
    setActiveKey(cluster.key);
    setSelected(new Set(cluster.members.map(m => m.description)));
  }, []);

  /**
   * Refusing a whole suggested merchant. It goes out of sight immediately —
   * that much is this sitting's decision either way — and the prompt then asks
   * whether to remember it. The members are unticked with it: refusing the
   * grouping is not the same as leaving it queued up for a rename.
   */
  const refuseMerchant = useCallback((cluster: PayeeCluster): void => {
    const subjectKey = payeeMerchantDismissalKey(cluster.key);
    setSittingMerchants(prev => new Set(prev).add(subjectKey));
    untick(cluster.members.map(m => m.description));
    setActiveKey(null);
    setQuery('');
    setPrompt({
      kind: 'payee-merchant',
      subjectKeys: [subjectKey],
      subject: `the “${cluster.key}” suggestion`,
      keepingMeans: 'it drops off the suggestions for now',
      success: `“${cluster.key}” will not be suggested again. Nothing was renamed and no payee `
        + 'is hidden — bring it back any time from “Dismissed suggestions” at the foot of this page.',
      ifNotSaved: 'it will be suggested again the next time this page opens',
    });
  }, [untick]);

  /** Refusing one payee's place in a suggestion. The payee itself stays listed. */
  const refuseLine = useCallback((merchantKey: string, payee: PayeeSummary): void => {
    const subjectKey = payeeLineDismissalKey(merchantKey, payee.description);
    setSittingLines(prev => new Set(prev).add(subjectKey));
    untick([payee.description]);
    setPrompt({
      kind: 'payee-line',
      subjectKeys: [subjectKey],
      subject: `“${payee.description}” under “${merchantKey}”`,
      keepingMeans: 'it drops out of this suggestion for now',
      success: `“${payee.description}” will stay out of the “${merchantKey}” suggestion. `
        + 'Nothing was renamed and the payee is still in the list below.',
      ifNotSaved: 'it will be part of that suggestion again the next time this page opens',
    });
  }, [untick]);

  /**
   * The widest refusal, and the one the owner asked for: the ticked payees come
   * off this page altogether — out of the list, out of every suggestion, out of
   * every count on the screen — rather than out of one grouping.
   *
   * Per payee, deliberately, so the answer is exactly as granular as the
   * selection was: some of a suggestion, all of it, or a handful of unrelated
   * lines picked out by hand. Each one is undone on its own from "Dismissed
   * suggestions" at the foot of the page.
   */
  const hideSelected = useCallback((): void => {
    const descriptions = selectedPayees.map(p => p.description);
    if (descriptions.length === 0) return;
    const subjectKeys = descriptions.map(payeeHiddenDismissalKey);

    setSittingHidden(prev => {
      const next = new Set(prev);
      for (const key of subjectKeys) next.add(key);
      return next;
    });
    untick(descriptions);
    setActiveKey(null);
    setSaveFailure(null);

    const many = descriptions.length > 1;
    // A SINGULAR phrase even for a batch ("this selection of 12 payees"): the
    // prompt reads it mid-sentence three times, twice as the subject of a verb,
    // and "these 12 payees is remembered as refused" is not a sentence.
    const named = many
      ? `this selection of ${descriptions.length.toLocaleString()} payees`
      : `“${descriptions[0]}”`;
    setPrompt({
      kind: 'payee-hidden',
      subjectKeys,
      subject: named,
      keepingMeans: many
        ? 'the selection drops off this page for now'
        : 'it drops off this page for now',
      success: many
        ? `${descriptions.length.toLocaleString()} payees will not be listed or suggested here `
          + 'again. Nothing was renamed and no transaction changed — bring any of them back from '
          + '“Dismissed suggestions” at the foot of this page.'
        : `“${descriptions[0]}” will not be listed or suggested here again. Nothing was renamed `
          + 'and no transaction changed — bring it back any time from “Dismissed suggestions” at '
          + 'the foot of this page.',
      ifNotSaved: many
        ? 'they will be back in the list the next time this page opens'
        : 'it will be back in the list the next time this page opens',
    });
  }, [selectedPayees, untick]);

  /**
   * Write a batch of refusals, one row each, and report exactly what got
   * through. Sequential rather than in parallel: these are small batches, the
   * order is the user's own, and a burst of inserts that half-fails is far
   * harder to say anything true about afterwards.
   *
   * Never throws. The caller needs the partial result — which keys are saved
   * and which are not — far more than it needs an exception.
   */
  const saveRefusals = useCallback(async (
    kind: DismissalKind,
    keys: string[]
  ): Promise<SaveOutcome> => {
    let saved = 0;
    const failedKeys: string[] = [];
    let reason = '';
    for (const key of keys) {
      try {
        // No transaction ids, deliberately: this refusal is about payee text,
        // which outlives any particular row — re-import a statement and the same
        // wording arrives on brand new transactions.
        await dismissSuggestion(kind, key, []);
        saved += 1;
        setSavedSoFar(saved);
      } catch (error) {
        failedKeys.push(key);
        // The first reason is the one shown: a batch that fails fails for one
        // cause (no connection, a constraint), and repeating it per row would
        // bury the consequence under the same sentence forty times.
        if (reason === '') reason = reasonFrom(error);
      }
    }
    return { saved, failedKeys, reason };
  }, [dismissSuggestion]);

  const confirmDismissal = useCallback(async (): Promise<void> => {
    if (!prompt) return;
    setSavingDismissal(true);
    setSavedSoFar(0);
    try {
      const outcome = await saveRefusals(prompt.kind, prompt.subjectKeys);
      setPrompt(null);
      if (outcome.failedKeys.length === 0) {
        showSuccess(prompt.success, 'Left out in future');
        return;
      }
      // Said on the page rather than only in a toast: the payees are already
      // out of the list, so the screen looks saved whether it saved or not.
      setSaveFailure({
        kind: prompt.kind,
        subjectKeys: outcome.failedKeys,
        saved: outcome.saved,
        ifNotSaved: prompt.ifNotSaved,
        success: prompt.success,
        reason: outcome.reason,
      });
      showError(new Error('That could not be saved — see the note on the page.'));
    } finally {
      setSavingDismissal(false);
    }
  }, [prompt, saveRefusals, showSuccess, showError]);

  const retrySave = useCallback(async (): Promise<void> => {
    if (!saveFailure) return;
    setSavingDismissal(true);
    setSavedSoFar(0);
    try {
      const outcome = await saveRefusals(saveFailure.kind, saveFailure.subjectKeys);
      if (outcome.failedKeys.length === 0) {
        setSaveFailure(null);
        showSuccess(saveFailure.success, 'Left out in future');
        return;
      }
      setSaveFailure({
        ...saveFailure,
        subjectKeys: outcome.failedKeys,
        saved: saveFailure.saved + outcome.saved,
        reason: outcome.reason,
      });
    } finally {
      setSavingDismissal(false);
    }
  }, [saveFailure, saveRefusals, showSuccess]);

  const handleRestore = useCallback(async (dismissal: SuggestionDismissal): Promise<void> => {
    setRestoringKey(dismissal.subjectKey);
    try {
      await restoreSuggestion(dismissal.kind, dismissal.subjectKey);
      // Also drop this sitting's copy of the refusal, or Restore would appear
      // to do nothing at all: the session set would go on hiding it until the
      // page was reloaded.
      const forget = (prev: ReadonlySet<string>): ReadonlySet<string> => {
        if (!prev.has(dismissal.subjectKey)) return prev;
        const next = new Set(prev);
        next.delete(dismissal.subjectKey);
        return next;
      };
      setSittingMerchants(forget);
      setSittingLines(forget);
      setSittingHidden(forget);
      showSuccess(
        dismissal.kind === 'payee-hidden'
          ? 'That payee is back in the list above.'
          : 'It is back in the suggestions above.',
        'Restored'
      );
    } catch (error) {
      showError(error);
    } finally {
      setRestoringKey(null);
    }
  }, [restoreSuggestion, showSuccess, showError]);

  const columns: Column<PayeeSummary>[] = useMemo(() => [
    {
      key: 'pick',
      header: '',
      width: 48,
      accessor: (payee) => (
        <input
          type="checkbox"
          checked={selected.has(payee.description)}
          onChange={() => toggle(payee.description)}
          onClick={(e) => e.stopPropagation()}
          className="rounded"
          aria-label={`Select ${payee.description}`}
        />
      ),
    },
    // Every column that HOLDS something sorts; the checkbox and Leave out do
    // not, because neither is a value a list can be put in order of.
    {
      key: 'payee',
      header: 'Payee',
      width: '38%',
      sortable: true,
      accessor: (payee) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-gray-900 dark:text-white" title={payee.description}>
            {payee.description}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{dateRange(payee)}</div>
        </div>
      ),
    },
    {
      key: 'merchant',
      header: 'Looks like',
      width: '22%',
      sortable: true,
      accessor: (payee) => (
        <span className="truncate block text-xs text-gray-500 dark:text-gray-400">
          {payee.merchantKey ?? '—'}
        </span>
      ),
    },
    {
      key: 'count',
      header: 'Transactions',
      width: 120,
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true,
      accessor: (payee) => (
        <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
          {payee.count.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      width: 140,
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true,
      accessor: (payee) => (
        <span className="text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-300">
          {formatCurrency(payee.total)}
        </span>
      ),
    },
    // Only while a suggestion is being worked on, and only against the payees
    // that suggestion is made of: "leave this one out" means nothing about a
    // payee nobody has proposed grouping.
    ...(activeCluster === null ? [] : [{
      key: 'leave-out',
      header: '',
      width: 110,
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (payee: PayeeSummary) => {
        if (activeMembers.has(payee.description)) {
          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); refuseLine(activeCluster.key, payee); }}
              aria-label={`Leave out ${payee.description} from the ${activeCluster.key} suggestion`}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Leave out
            </button>
          );
        }
        if (payee.merchantKey === activeCluster.key) {
          return <span className="text-xs text-gray-400 dark:text-gray-500">Left out</span>;
        }
        return null;
      },
    }]),
  ], [selected, toggle, formatCurrency, activeCluster, activeMembers, refuseLine]);

  return (
    <PageWrapper title="Payee cleanup" contentClassName="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Banks put a different reference in every line, so one shop arrives as
        hundreds of payees. Tick the ones that are really the same merchant and
        give them a single name — your register, reports and payee memory then
        see one shop instead of hundreds.
      </p>

      {allClusters.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            {/* The total, in the heading, because the owner could not tell how
                much work the page was proposing: "when you tidy up one, the
                next appears, so I don't really know how many different
                suggestions the system is making." It is stated only once the
                refusals have been read — a number that drops the moment they
                arrive would be worse than no number at all. */}
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {!dismissalsChecked
                ? 'These look like the same merchant'
                : allClusters.length === 1
                  ? '1 group looks like the same merchant'
                  : `${allClusters.length.toLocaleString()} groups look like the same merchant`}
            </h2>
            {/* One suggestion has no order to choose. */}
            {dismissalsChecked && allClusters.length > 1 && (
              <div
                role="group"
                aria-label="Order the suggestions"
                className="ml-auto inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5"
              >
                {ORDERS.map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOrder(value)}
                    aria-pressed={order === value}
                    title={hint}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      order === value
                        ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {dismissalsChecked && (
              <>
                Tidying them all would give {payeesInSuggestions.toLocaleString()} payees{' '}
                {allClusters.length.toLocaleString()}{' '}
                {allClusters.length === 1 ? 'name' : 'names'}.{' '}
              </>
            )}
            A guess from the payee text. Choosing one narrows the list and ticks
            its payees — nothing is renamed until you say so.
          </p>

          {suggestionDismissalsStatus === 'error' && (
            <p className="mb-3 text-sm rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
              The suggestions you asked to leave out could not be read, so some of them may be
              offered again below. Nothing has changed — reload the page to try again.
            </p>
          )}

          {!dismissalsChecked ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Checking which of these you have already refused…
            </p>
          ) : (
            /* A plain scrolling box rather than a virtualised one, deliberately.
               A virtualised list is MEASURED — it renders nothing at all until
               the browser answers "how tall is your parent?", which is the trap
               the payee table below had to be rescued from — and the ceiling
               here is orders of magnitude lower than the table's: a register of
               9,000 payees produced 18 suggestions in the measured case and
               4,500 in a contrived worst case where every payee pairs off with
               exactly one other, against the tens of thousands of rows the table
               must survive. Rows are memoised so picking one re-renders two.

               The element persists across renders, so the browser keeps its
               scroll position when a suggestion is refused and the rest close
               up — the user stays where they were working. */
            <ul
              aria-label="Suggested merchants"
              style={{ maxHeight: SUGGESTION_LIST_MAX_HEIGHT }}
              className="overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
            >
              {orderedClusters.map(cluster => (
                <SuggestionRow
                  key={cluster.key}
                  cluster={cluster}
                  active={cluster.key === activeKey}
                  onPick={applyCluster}
                />
              ))}
            </ul>
          )}

          {/* The refusals live here rather than on the rows: the decision only
              makes sense once the payees behind the guess are on screen. */}
          {activeCluster !== null && (
            <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                {/* What the SUGGESTION is, not what is ticked: the user is
                    free to untick rows, and this line must stay true when they
                    do. */}
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>{activeCluster.key}</strong> — {activeCluster.members.length.toLocaleString()}{' '}
                  payee{activeCluster.members.length === 1 ? '' : 's'},{' '}
                  {activeCluster.transactionCount.toLocaleString()} transaction
                  {activeCluster.transactionCount === 1 ? '' : 's'} between them.
                </p>
                <button
                  type="button"
                  onClick={() => refuseMerchant(activeCluster)}
                  className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Not the same merchant
                </button>
              </div>
              {/* Three refusals, three consequences, said in the order they
                  narrow: the user has to be able to tell which one they are
                  invoking without learning any vocabulary. */}
              <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
                Only some of them belong together? <strong>Leave out</strong> beside a payee keeps
                just that one out of this grouping. <strong>Not the same merchant</strong> drops the
                whole grouping. Both leave every payee in the list below — to take payees off this
                page altogether, tick them and use <strong>Don't offer these again</strong>.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="relative">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Typing is leaving the suggestion behind: the panel and the
              // per-payee buttons belong to the list the chip put on screen.
              setActiveKey(null);
            }}
            placeholder="Search payees — try amazon, or interest"
            aria-label="Search payees"
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {shown.length.toLocaleString()} of {payees.length.toLocaleString()} payees
          </span>
          {/* Only when there are some: a nil count is not news, it is noise. */}
          {hiddenCount > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {hiddenCount.toLocaleString()} hidden — bring {hiddenCount === 1 ? 'it' : 'them'} back
              from “Dismissed suggestions” below.
            </span>
          )}
          <button
            type="button"
            onClick={selectAllShown}
            disabled={shown.length === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Select all shown ({shown.length.toLocaleString()})
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XIcon size={12} />
              Clear selection
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selected.size.toLocaleString()} selected ·{' '}
              {selectedTransactionCount.toLocaleString()} transaction
              {selectedTransactionCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={hideSelected}
              disabled={selected.size === 0}
              aria-describedby="payee-bulk-help"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Don't offer these again
            </button>
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              disabled={selected.size === 0}
              aria-describedby="payee-bulk-help"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rename selected…
            </button>
          </div>
        </div>

        {/* What each button does to the ticked rows, before either is pressed —
            one changes your transactions, the other changes only this page. */}
        <p id="payee-bulk-help" className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Rename selected…</strong> gives every ticked payee one name, on every transaction
          behind it. <strong>Don't offer these again</strong> takes the ticked payees off this page
          — out of the list, out of the suggestions and out of the counts — and changes no
          transaction at all.
        </p>

        {saveFailure && (
          <div
            role="alert"
            className="rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
          >
            <p className="text-sm">
              {saveFailure.saved === 0
                ? `Nothing was saved, so ${saveFailure.ifNotSaved}.`
                : `${saveFailure.saved.toLocaleString()} of `
                  + `${(saveFailure.saved + saveFailure.subjectKeys.length).toLocaleString()} `
                  + 'were saved. The other '
                  + `${saveFailure.subjectKeys.length.toLocaleString()} were not, so they will be `
                  + 'back the next time this page opens.'}
            </p>
            <p className="mt-1 text-xs">Reason given: {saveFailure.reason}</p>
            <button
              type="button"
              onClick={() => void retrySave()}
              disabled={savingDismissal}
              className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
            >
              {savingDismissal ? 'Saving…' : 'Try again'}
            </button>
          </div>
        )}

        {/* Virtualised: a full register can hold tens of thousands of distinct
            payees, and rendering them all is what would freeze the tab.
            ─ WHY h-full IS NOT DECORATION ──────────────────────────────────
            The height on this wrapper is the only definite one in the column,
            and a virtualised list is measured, not laid out: AutoSizer asks the
            browser how tall its parent is and renders NOTHING while the answer
            is zero. VirtualizedTable's own root is `flex flex-col` with an AUTO
            height, so without h-full it never claims the 560px above it, its
            flex-1 list child resolves against a content height of nothing, and
            the measurement comes back 0 — which is a table that says "9,137
            payees" over a completely empty body. Under fifty rows the same
            omission fails the other way: the plain list grows to its content,
            overflows this box (which does not clip), and paints straight over
            the "Dismissed suggestions" section beneath it. Both were on screen
            in the owner's report. */}
        <div style={{ height: LIST_HEIGHT }}>
          <VirtualizedTable
            items={sortedShown}
            columns={columns}
            getItemKey={(payee: PayeeSummary) => payee.description}
            onRowClick={(payee: PayeeSummary) => toggle(payee.description)}
            rowHeight={56}
            selectedItems={selected}
            // Click a header to order by it, click it again to turn it round.
            // Selection is held by payee TEXT, not by row position, so it
            // survives every re-sort untouched.
            onSort={(column: string, direction: 'asc' | 'desc') => {
              if (!isPayeeSortField(column)) return;
              setSortField(column);
              setSortDirection(direction);
            }}
            sortColumn={sortField}
            sortDirection={sortDirection}
            className="h-full"
            // A ticked row drops its zebra stripe, so it needs a colour of its
            // own or selection becomes invisible while scrolling.
            rowClassName={(payee: PayeeSummary) =>
              selected.has(payee.description) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
            }
            emptyMessage={
              everyPayee.length === 0
                ? 'No transactions yet, so there are no payees to tidy.'
                : payees.length === 0
                  ? 'Every payee is hidden. Bring one back from “Dismissed suggestions” below.'
                  : 'No payee matches that search.'
            }
          />
        </div>

        <DismissedPayeeSuggestions
          dismissals={payeeDismissals}
          onRestore={dismissal => void handleRestore(dismissal)}
          restoringKey={restoringKey}
          className="pt-4 border-t border-gray-200 dark:border-gray-700"
        />
      </div>

      <RenamePayeesModal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        selected={selectedPayees}
        onRenamed={() => setSelected(new Set())}
      />

      {prompt && (
        <DismissSuggestionPrompt
          isOpen
          subject={prompt.subject}
          keepingMeans={prompt.keepingMeans}
          saving={savingDismissal}
          // A batch of refusals is a batch of writes, and a button that says
          // only "Saving…" for forty of them looks stuck rather than busy.
          savingLabel={
            prompt.subjectKeys.length > 1
              ? `Saving ${savedSoFar.toLocaleString()} of ${prompt.subjectKeys.length.toLocaleString()}…`
              : undefined
          }
          onKeep={() => setPrompt(null)}
          onDismiss={() => void confirmDismissal()}
        />
      )}
    </PageWrapper>
  );
}
