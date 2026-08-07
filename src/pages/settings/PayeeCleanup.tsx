import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import PageWrapper from '../../components/PageWrapper';
import { VirtualizedTable, type Column } from '../../components/VirtualizedTable';
import RenamePayeesModal from '../../components/RenamePayeesModal';
import { SearchIcon, XIcon } from '../../components/icons';
import {
  summarisePayees,
  filterPayees,
  buildPayeeClusters,
  type PayeeSummary,
} from '../../utils/payeeCleanup';

/**
 * Payee cleanup — one screen for the thousands of near-duplicate payees a
 * bank feed creates by baking a transaction reference into every description.
 *
 * The screen never decides anything. It counts, it suggests which payees look
 * like one merchant, and it renames exactly what the user ticked.
 */

/** How many clusters to offer as one-click shortcuts. */
const SUGGESTION_LIMIT = 8;

const dateRange = (payee: PayeeSummary): string => {
  const format = (d: Date): string =>
    d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const from = format(payee.earliest);
  const to = format(payee.latest);
  return from === to ? from : `${from} – ${to}`;
};

export default function PayeeCleanup(): React.JSX.Element {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renameOpen, setRenameOpen] = useState(false);

  // One pass over every transaction, memoised on the array identity. Filtering
  // runs against the summaries (thousands) rather than the transactions (tens
  // of thousands), and the query is deferred so a keystroke never waits on the
  // filter — the list catches up a frame later instead of the field stuttering.
  const payees = useMemo(() => summarisePayees(transactions), [transactions]);
  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => filterPayees(payees, deferredQuery), [payees, deferredQuery]);
  const clusters = useMemo(() => buildPayeeClusters(payees).slice(0, SUGGESTION_LIMIT), [payees]);

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
  const applyCluster = useCallback((key: string, members: PayeeSummary[]): void => {
    setQuery(key);
    setSelected(new Set(members.map(m => m.description)));
  }, []);

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
  ], [selected, toggle, formatCurrency]);

  return (
    <PageWrapper title="Payee cleanup" contentClassName="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Banks put a different reference in every line, so one shop arrives as
        hundreds of payees. Tick the ones that are really the same merchant and
        give them a single name — your register, reports and payee memory then
        see one shop instead of hundreds.
      </p>

      {clusters.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            These look like the same merchant
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            A guess from the payee text. Choosing one narrows the list and ticks
            its payees — nothing is renamed until you say so.
          </p>
          <div className="flex flex-wrap gap-2">
            {clusters.map(cluster => (
              <button
                key={cluster.key}
                type="button"
                onClick={() => applyCluster(cluster.key, cluster.members)}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {cluster.key}
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  {cluster.members.length.toLocaleString()} payees ·{' '}
                  {cluster.transactionCount.toLocaleString()} transactions
                </span>
              </button>
            ))}
          </div>
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
            onChange={(e) => setQuery(e.target.value)}
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
      </div>

      <RenamePayeesModal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        selected={selectedPayees}
        onRenamed={() => setSelected(new Set())}
      />
    </PageWrapper>
  );
}
