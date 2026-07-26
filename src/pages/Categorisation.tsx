import React, { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { computeIncomeExpense } from '../utils/incomeExpense';
import { expandSplitTransactions, type SplitExpandedTransaction } from '../utils/transactionSplits';
import { groupUncategorisedByAccount } from '../utils/uncategorisedByAccount';
import TransferSweepModal from '../components/TransferSweepModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import ReportDrillModal, { type ReportDrillTarget } from '../components/reports/ReportDrillModal';
import { ArrowRightLeftIcon, TagIcon, ListIcon, CheckCircleIcon, Building2Icon, ChevronRightIcon } from '../components/icons';

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
  const { transactions, transactionSplits, accounts, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const [showTransferSweep, setShowTransferSweep] = useState(false);
  const [showBulkCategorize, setShowBulkCategorize] = useState(false);

  // Split parents become one row per line, so a half-filed split still shows
  // the line that needs a category rather than hiding behind its parent.
  const rows = useMemo(
    () => expandSplitTransactions(transactions, transactionSplits),
    [transactions, transactionSplits]
  );

  const flows = useMemo(() => computeIncomeExpense(rows, [], categories), [rows, categories]);

  const uncategorised = flows.uncategorizedRows;
  const count = uncategorised.length;

  const accountName = useMemo(() => {
    const byId = new Map(accounts.map(a => [a.id, a.name]));
    return (id: string): string => byId.get(id) ?? 'Unknown account';
  }, [accounts]);

  /** Where the unfiled rows actually are, worst first. */
  const byAccount = useMemo(
    () => groupUncategorisedByAccount(uncategorised, accountName),
    [uncategorised, accountName]
  );

  const openDrill = (title: string, drillRows: SplitExpandedTransaction[]): void => {
    setDrill({ title, bucket: 'uncategorized', rows: drillRows, total: null });
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8 text-center">
          <CheckCircleIcon size={32} className="mx-auto text-blue-600 dark:text-blue-400" />
          <p className="mt-3 font-semibold text-gray-900 dark:text-white">Everything is filed</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Every transaction has a category, so every report is counting all of your money.
          </p>
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
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <Building2Icon size={20} className="text-gray-600 dark:text-gray-400" />
                  </div>
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
