import React, { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { buildCategoryNameLookup } from '../../utils/categoryNames';
import { selectTopTransactions } from '../../utils/topTransactions';
import type { Category } from '../../types';
import type { SplitExpandedTransaction } from '../../utils/transactionSplits';
import { preferences } from '../../services/preferencesService';

/**
 * The biggest real money movements of the period, on the "Monthly income and
 * expenses" report.
 *
 * Which rows qualify is decided once, in utils/topTransactions, off the shared
 * income/expense classifier: transfer legs and revaluations are movements
 * between pockets or changes in VALUE, never money earned or spent, so they
 * never appear here (nor in the PDF, which selects through the same function).
 *
 * Every heading sorts, the app-wide way: click to sort, click again to flip,
 * ↑ ascending / ↓ descending. The list opens on Date, newest first — the order
 * a person reads a statement in — while WHICH ten rows are shown is always the
 * ten biggest. Amount sorts by size, so "biggest first" means the largest
 * £1,000 payment above a £900 one whichever way round their signs are.
 *
 * A whole row is the click target (mouse, keyboard and touch alike) and opens
 * the transaction in the editor — a split line opens its PARENT, the real record.
 */

const SHOW_KEY = 'reportsShowTopTransactions';

type SortKey = 'date' | 'description' | 'category' | 'amount';

const COLUMNS: ReadonlyArray<readonly [SortKey, string]> = [
  ['date', 'Date'],
  ['description', 'Description'],
  ['category', 'Category'],
  ['amount', 'Amount'],
];

export default function TopTransactionsTable({
  rows,
  categories,
  onOpenTransaction,
}: {
  /** The report's period- and account-filtered rows, split-expanded. */
  rows: SplitExpandedTransaction[];
  categories: Category[];
  /** Opens the transaction (a split line passes its parent's id). */
  onOpenTransaction: (transactionId: string) => void;
}): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  // A curiosity next to the matrix, so it starts hidden; the choice is
  // persisted like the report's other view preferences.
  const [show, setShow] = useState<boolean>(() => preferences.getItem(SHOW_KEY) === '1');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  // Category ids are UUIDs — everything user-facing resolves through this
  // lookup ("Parent : Child", "Uncategorised" for a dangling id).
  const categoryName = useMemo(() => buildCategoryNameLookup(categories), [categories]);

  const toggle = (): void => {
    setShow(prev => {
      preferences.setItem(SHOW_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      // Sensible first direction per column: newest dates and biggest amounts
      // first; text A→Z.
      setSortDir(key === 'date' || key === 'amount' ? -1 : 1);
    }
  };

  const arrow = (key: SortKey): string => (sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  const top = useMemo(() => selectTopTransactions(rows, categories), [rows, categories]);

  const sorted = useMemo(() => {
    // Array#sort is stable, so rows equal on the chosen column keep the
    // selection order — biggest first, which is the right tie-break here.
    return [...top].sort((a, b) => {
      switch (sortKey) {
        case 'description':
          return sortDir * a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
        case 'category':
          return sortDir * categoryName(a.category).localeCompare(categoryName(b.category), undefined, { sensitivity: 'base' });
        case 'amount':
          return sortDir * (Math.abs(a.amount) - Math.abs(b.amount));
        default:
          return sortDir * (new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    });
  }, [top, sortKey, sortDir, categoryName]);

  const open = (transaction: SplitExpandedTransaction): void => {
    onOpenTransaction(transaction.splitParentId ?? transaction.id);
  };

  // Enter and Space activate a row, the way they activate a button — the same
  // keyboard contract the Dashboard's clickable account cards use.
  const activateOnKey = (
    event: React.KeyboardEvent,
    transaction: SplitExpandedTransaction
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(transaction);
    }
  };

  const EMPTY = 'No income or spending in this period — transfers and value adjustments are neither.';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
      <div className={`flex items-center justify-between gap-4 p-6 ${show ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}>
        <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Top Transactions</h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={show}
          aria-controls="top-transactions-panel"
          className="flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          {show ? 'Hide' : 'Show'}
          {show ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        </button>
      </div>
      <div id="top-transactions-panel" hidden={!show}>
        {/* Mobile card view */}
        <div className="block sm:hidden p-4">
          {sorted.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{EMPTY}</p>
          ) : (
            <div className="space-y-3">
              {sorted.map(transaction => (
                <div
                  key={transaction.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(transaction)}
                  onKeyDown={event => activateOnKey(event, transaction)}
                  title="View or edit this transaction"
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{categoryName(transaction.category)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                    }`}>
                      {/* Amounts are stored signed; derive the sign from the value */}
                      {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table view — scrolls inside its own box. */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">
              The ten largest income and spending transactions in the selected period — transfers and
              value adjustments excluded. Each column heading sorts the list; each row opens its transaction.
            </caption>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {COLUMNS.map(([key, label]) => (
                  <th
                    key={key}
                    scope="col"
                    className={`px-4 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 uppercase ${
                      key === 'category' ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      title={`Sort by ${label.toLowerCase()}`}
                    >
                      {label}{arrow(key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {EMPTY}
                  </td>
                </tr>
              ) : (
                sorted.map(transaction => (
                  // The whole row is the target — no button, no box drawn round
                  // the description. role="button" so keyboard and screen-reader
                  // users get the same affordance the pointer has.
                  <tr
                    key={transaction.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => open(transaction)}
                    onKeyDown={event => activateOnKey(event, transaction)}
                    title="View or edit this transaction"
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {categoryName(transaction.category)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium tabular-nums whitespace-nowrap ${
                      transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                    }`}>
                      {/* Amounts are stored signed; derive the sign from the value */}
                      {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
