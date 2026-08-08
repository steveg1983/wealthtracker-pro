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
  type PayeeCluster,
  type PayeeSummary,
} from '../../utils/payeeCleanup';
import {
  dismissedKeys,
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

/** How many clusters to offer as one-click shortcuts. */
const SUGGESTION_LIMIT = 8;

/** The two kinds of refusal this screen records. */
const PAYEE_KINDS: readonly DismissalKind[] = ['payee-merchant', 'payee-line'];

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

interface DismissPrompt {
  kind: DismissalKind;
  subjectKey: string;
  /** Reads mid-sentence: "Do you want … eliminated from this report in future?" */
  subject: string;
  /** What answering No leaves behind. */
  keepingMeans: string;
  /** Said once the refusal is saved — the consequence, not the count. */
  success: string;
}

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
  /** Refused for this sitting only — the answer to "No, just this once". */
  const [sittingMerchants, setSittingMerchants] = useState<ReadonlySet<string>>(new Set());
  const [sittingLines, setSittingLines] = useState<ReadonlySet<string>>(new Set());
  const [prompt, setPrompt] = useState<DismissPrompt | null>(null);
  const [savingDismissal, setSavingDismissal] = useState(false);
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
  const payees = useMemo(() => summarisePayees(transactions), [transactions]);
  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => filterPayees(payees, deferredQuery), [payees, deferredQuery]);

  const refused = useMemo(() => ({
    merchants: withSessionKeys(
      dismissedKeys(suggestionDismissals, 'payee-merchant'), sittingMerchants
    ),
    lines: withSessionKeys(dismissedKeys(suggestionDismissals, 'payee-line'), sittingLines),
  }), [suggestionDismissals, sittingMerchants, sittingLines]);

  const dismissalsChecked =
    suggestionDismissalsStatus === 'ready' || suggestionDismissalsStatus === 'error';

  // Every cluster, then the shortcuts. The active one is looked up in the FULL
  // list rather than the eight on screen: leaving a payee out shrinks a cluster,
  // and a cluster that slipped out of the top eight mid-decision must not take
  // the panel the user is working in with it.
  const allClusters = useMemo(() => buildPayeeClusters(payees, refused), [payees, refused]);
  const clusters = useMemo(() => allClusters.slice(0, SUGGESTION_LIMIT), [allClusters]);
  const activeCluster = useMemo(
    () => allClusters.find(cluster => cluster.key === activeKey) ?? null,
    [allClusters, activeKey]
  );

  const payeeDismissals = useMemo(
    () => suggestionDismissals.filter(d => PAYEE_KINDS.includes(d.kind)),
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
      subjectKey,
      subject: `the “${cluster.key}” suggestion`,
      keepingMeans: 'it drops off the suggestions for now',
      success: `“${cluster.key}” will not be suggested again. Nothing was renamed and no payee `
        + 'is hidden — bring it back any time from “Dismissed suggestions” at the foot of this page.',
    });
  }, [untick]);

  /** Refusing one payee's place in a suggestion. The payee itself stays listed. */
  const refuseLine = useCallback((merchantKey: string, payee: PayeeSummary): void => {
    const subjectKey = payeeLineDismissalKey(merchantKey, payee.description);
    setSittingLines(prev => new Set(prev).add(subjectKey));
    untick([payee.description]);
    setPrompt({
      kind: 'payee-line',
      subjectKey,
      subject: `“${payee.description}” under “${merchantKey}”`,
      keepingMeans: 'it drops out of this suggestion for now',
      success: `“${payee.description}” will stay out of the “${merchantKey}” suggestion. `
        + 'Nothing was renamed and the payee is still in the list below.',
    });
  }, [untick]);

  const confirmDismissal = useCallback(async (): Promise<void> => {
    if (!prompt) return;
    setSavingDismissal(true);
    try {
      // No transaction ids, deliberately: this refusal is about payee text,
      // which outlives any particular row — re-import a statement and the same
      // wording arrives on brand new transactions.
      await dismissSuggestion(prompt.kind, prompt.subjectKey, []);
      showSuccess(prompt.success, 'Left out in future');
      setPrompt(null);
    } catch (error) {
      showError(error);
    } finally {
      setSavingDismissal(false);
    }
  }, [prompt, dismissSuggestion, showSuccess, showError]);

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
      showSuccess('It is back in the suggestions above.', 'Restored');
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
    {
      key: 'payee',
      header: 'Payee',
      width: '38%',
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            These look like the same merchant
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
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
            <div className="flex flex-wrap gap-2">
              {clusters.map(cluster => (
                <button
                  key={cluster.key}
                  type="button"
                  onClick={() => applyCluster(cluster)}
                  aria-pressed={cluster.key === activeKey}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    cluster.key === activeKey
                      ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {cluster.key}
                  <span className="ml-2 text-gray-400 dark:text-gray-500">
                    {cluster.members.length.toLocaleString()} payees ·{' '}
                    {cluster.transactionCount.toLocaleString()} transactions
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* The refusals live here rather than on the chips: the decision only
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
              <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
                Only some of them belong together? Use <strong>Leave out</strong> beside a payee to
                keep just that one out of this suggestion.
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
              onClick={() => setRenameOpen(true)}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rename selected…
            </button>
          </div>
        </div>

        {/* Virtualised: a full register can hold tens of thousands of distinct
            payees, and rendering them all is what would freeze the tab. */}
        <div style={{ height: 560 }}>
          <VirtualizedTable
            items={shown}
            columns={columns}
            getItemKey={(payee: PayeeSummary) => payee.description}
            onRowClick={(payee: PayeeSummary) => toggle(payee.description)}
            rowHeight={56}
            selectedItems={selected}
            // A ticked row drops its zebra stripe, so it needs a colour of its
            // own or selection becomes invisible while scrolling.
            rowClassName={(payee: PayeeSummary) =>
              selected.has(payee.description) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
            }
            emptyMessage={
              payees.length === 0
                ? 'No transactions yet, so there are no payees to tidy.'
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
          onKeep={() => setPrompt(null)}
          onDismiss={() => void confirmDismissal()}
        />
      )}
    </PageWrapper>
  );
}
