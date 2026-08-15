import React, { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { computeIncomeExpense } from '../utils/incomeExpense';
import { expandSplitTransactions, type SplitExpandedTransaction } from '../utils/transactionSplits';
import { groupUncategorisedByAccount } from '../utils/uncategorisedByAccount';
import { groupSuggestedByCategory } from '../utils/categoryProvenance';
import { useAccountNames } from '../hooks/useAccountNames';
import { useToast } from '../contexts/ToastContext';
import TransferSweepModal from '../components/TransferSweepModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import ReportDrillModal, { type ReportDrillTarget } from '../components/reports/ReportDrillModal';
import { ArrowRightLeftIcon, TagIcon, ListIcon, CheckCircleIcon, ChevronRightIcon } from '../components/icons';
import EmptyState from '../components/EmptyState';
import type { Transaction } from '../types';

/**
 * Categorisation — the counterpart to Reconciliation.
 *
 * Reconciliation answers "does this account agree with the bank?". This page
 * answers "is every transaction filed?", which is the other thing that has to
 * be true before a report can be trusted. A row with no category is not income
 * and not an expense, so it is excluded from every total in the app; until it
 * is filed it is money the reports cannot see.
 *
 * The three ways out already existed, but only inside the report gallery — you
 * had to already be looking at a report to find them, which is backwards for a
 * chore you do deliberately. They live here now, and the reports' review band
 * still offers the same actions in place.
 *
 * Deliberately reads ALL transactions, not a period: a chore is only finished
 * when nothing is left, and a date filter would hide the work rather than do
 * it.
 */
export default function Categorisation(): React.JSX.Element {
  const { transactions, transactionSplits, categories, confirmTransactionCategories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();

  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const [showTransferSweep, setShowTransferSweep] = useState(false);
  const [showBulkCategorize, setShowBulkCategorize] = useState(false);
  /** Which category group is mid-confirm, so its button can say so. */
  const [confirmingCategoryId, setConfirmingCategoryId] = useState<string | null>(null);

  // Split parents become one row per line, so a half-filed split still shows
  // the line that needs a category rather than hiding behind its parent.
  const rows = useMemo(
    () => expandSplitTransactions(transactions, transactionSplits),
    [transactions, transactionSplits]
  );

  const flows = useMemo(() => computeIncomeExpense(rows, [], categories), [rows, categories]);

  const uncategorised = flows.uncategorizedRows;
  const count = uncategorised.length;

  // Includes CLOSED accounts — old history is exactly where the
  // uncategorised backlog lives, and "Unknown account" was just a failure
  // to look closed accounts up.
  const accountName = useAccountNames();

  /** Where the unfiled rows actually are, worst first. */
  const byAccount = useMemo(
    () => groupUncategorisedByAccount(uncategorised, accountName),
    [uncategorised, accountName]
  );

  /**
   * Categories the app guessed and nobody has agreed with yet.
   *
   * Deliberately built from the RAW transactions, not the split-expanded rows:
   * nothing in the app ever guesses a split line (a split is always typed by
   * hand or stated by an imported file), so expanding here would only invent
   * work. A split parent's own category is blank, which is not a suggestion
   * either — see categoryProvenance.
   */
  const suggestedGroups = useMemo(() => groupSuggestedByCategory(transactions), [transactions]);
  const suggestedCount = useMemo(
    () => suggestedGroups.reduce((sum, group) => sum + group.rows.length, 0),
    [suggestedGroups]
  );

  const categoryLabel = (categoryId: string): string =>
    categories.find(c => c.id === categoryId)?.name ?? 'Unknown category';

  const confirmGroup = async (categoryId: string, groupRows: Transaction[]): Promise<void> => {
    setConfirmingCategoryId(categoryId);
    try {
      const confirmed = await confirmTransactionCategories(groupRows.map(row => row.id));
      showSuccess(
        `${confirmed.toLocaleString()} transaction${confirmed === 1 ? '' : 's'} confirmed as ${categoryLabel(categoryId)}.`,
        'Categories confirmed'
      );
    } catch (error) {
      showError(error);
    } finally {
      setConfirmingCategoryId(null);
    }
  };

  const openDrill = (title: string, drillRows: SplitExpandedTransaction[]): void => {
    setDrill({ title, bucket: 'uncategorized', rows: drillRows, total: null });
  };

  /**
   * The suggested list is NOT the uncategorised bucket: those rows already have
   * a category, so the drill's blanks-only inline filing has nothing to do
   * there. 'neutral' gives the plain list with each row opening its editor,
   * which is the right escape hatch when a group needs looking at properly.
   */
  const openSuggestedDrill = (categoryId: string, groupRows: Transaction[]): void => {
    setDrill({
      title: `Suggested as ${categoryLabel(categoryId)}`,
      bucket: 'neutral',
      rows: groupRows,
      total: null,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Categorisation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          A transaction with no category is left out of every total in the app. This is where you file them.
        </p>
      </div>

      {count === 0 ? (
        // The hand-rolled centred copy this page carried since batch 7 is what
        // exposed the inconsistency — and it was the one that was right. Now
        // the shared component, which the owner centred app-wide on 15 August.
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={<CheckCircleIcon size={32} className="text-blue-600 dark:text-blue-400" />}
            title="Everything is filed"
            description={
              suggestedCount === 0
                ? 'Every transaction has a category, so every report is counting all of your money.'
                : 'Every transaction has a category, so every report is counting all of your money — but some of those categories are still the app’s suggestions, below.'
            }
          />
        </div>
      ) : (
        <>
          {/* What is outstanding, and what it is worth. Two columns on a phone,
              four on a desktop — the same shape as the reconciliation bar. */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-amber-300 dark:border-amber-600 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Needs a category</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {count.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Money in</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(flows.uncategorizedIn.toNumber())}
                </p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Money out</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(flows.uncategorizedOut.toNumber())}
                </p>
              </div>
            </div>
          </div>

          {/* The three ways through, cheapest first: a transfer sweep can clear
              thousands of rows without a decision, filing a payee clears every
              row for that merchant at once, and one-by-one is the fallback. */}
          <div className="grid gap-3 md:grid-cols-3">
            <ActionCard
              icon={<ArrowRightLeftIcon size={22} />}
              title="Match transfers"
              body="Find equal-and-opposite pairs across your accounts and link them in one go. Money moved between your own accounts is neither income nor spending."
              onClick={() => setShowTransferSweep(true)}
            />
            <ActionCard
              icon={<TagIcon size={22} />}
              title="Categorise by payee"
              body="File a whole merchant at once, and teach future imports to file it for you."
              onClick={() => setShowBulkCategorize(true)}
            />
            <ActionCard
              icon={<ListIcon size={22} />}
              title="Review one by one"
              body={`Work through all ${count.toLocaleString()} outstanding transactions individually.`}
              onClick={() => openDrill('Uncategorised transactions', uncategorised)}
            />
          </div>

          {/* Which accounts the work is actually in — the same "pick one and
              clear it" shape as the reconciliation account list. */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">By account</h2>
            <div className="flex flex-col gap-2">
              {byAccount.map(({ accountId, rows: accountRows }) => (
                <button
                  key={accountId}
                  type="button"
                  onClick={() => openDrill(`Uncategorised — ${accountName(accountId)}`, accountRows)}
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all p-4 flex items-center gap-3"
                >
                  <span className="font-medium text-gray-900 dark:text-white truncate min-w-0 flex-1">
                    {accountName(accountId)}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                    {accountRows.length.toLocaleString()}
                  </span>
                  <ChevronRightIcon size={18} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Suggestions waiting to be agreed with ────────────────────────────
          A separate chore from the one above, and deliberately below it: an
          unfiled row is money the reports cannot see, while a suggested row is
          already counted and merely unverified. Shown even when nothing is
          uncategorised, because "is every category actually mine?" is a
          question in its own right.

          There is no "confirm everything" button, and that is on purpose.
          Confirming without looking would relabel every guess as a decision in
          one click and put us straight back where we started — unable to tell
          what has been checked. A category group is the smallest unit that can
          honestly be judged at a glance. */}
      {suggestedCount > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Suggested categories ({suggestedCount.toLocaleString()})
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            The app filled these in from what you have filed before. They already count in your
            reports — confirming just records that you have checked them.
          </p>
          <div className="flex flex-col gap-2">
            {suggestedGroups.map(({ categoryId, rows: groupRows }) => (
              <div
                key={categoryId}
                className="w-full bg-white dark:bg-gray-800 rounded-xl border-2 border-amber-200 dark:border-amber-700/60 p-4 flex items-center gap-3"
              >
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex-shrink-0">
                  <TagIcon size={20} className="text-amber-700 dark:text-amber-400" />
                </div>
                <button
                  type="button"
                  onClick={() => openSuggestedDrill(categoryId, groupRows)}
                  className="font-medium text-gray-900 dark:text-white truncate min-w-0 flex-1 text-left hover:underline"
                  title="Look through these transactions before deciding"
                >
                  {categoryLabel(categoryId)}
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {groupRows.length.toLocaleString()} transaction{groupRows.length === 1 ? '' : 's'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void confirmGroup(categoryId, groupRows)}
                  disabled={confirmingCategoryId !== null}
                  className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                >
                  {confirmingCategoryId === categoryId ? 'Confirming…' : 'Confirm these'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
      <TransferSweepModal isOpen={showTransferSweep} onClose={() => setShowTransferSweep(false)} />
      <BulkCategorizeModal isOpen={showBulkCategorize} onClose={() => setShowBulkCategorize(false)} />
    </div>
  );
}

function ActionCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all p-4 flex flex-col gap-2 min-h-[48px]"
    >
      <span className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
        <span className="text-primary dark:text-blue-400">{icon}</span>
        {title}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{body}</span>
    </button>
  );
}
