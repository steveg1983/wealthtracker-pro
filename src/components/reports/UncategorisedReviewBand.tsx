import React, { useState } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import TransferSweepModal from '../TransferSweepModal';
import BulkCategorizeModal from '../BulkCategorizeModal';
import ReportDrillModal, { type ReportDrillTarget } from './ReportDrillModal';
import type { Category } from '../../types';
import type { IncomeExpenseBreakdown } from '../../utils/incomeExpense';

/**
 * The review band: rows with no category are EXCLUDED from every total in the
 * gallery (no category = not income, not an expense), so each report says so
 * out loud and offers the three ways out — review them one by one, match
 * transfers automatically, or file a whole payee at once.
 *
 * Shown on every report whose figures those rows would otherwise have joined,
 * so the exclusion can never look like a quiet loss of money.
 */
export default function UncategorisedReviewBand({
  flows,
  categories,
}: {
  flows: IncomeExpenseBreakdown;
  categories: Category[];
}): React.JSX.Element | null {
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const [showTransferSweep, setShowTransferSweep] = useState(false);
  const [showBulkCategorize, setShowBulkCategorize] = useState(false);

  const count = flows.uncategorizedRows.length;
  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setDrill({
          title: 'Uncategorised Transactions',
          bucket: 'uncategorized',
          rows: flows.uncategorizedRows,
          total: null,
        })}
        className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-5 py-3 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {count.toLocaleString()} uncategorised transaction{count === 1 ? '' : 's'} excluded from these totals
        </span>
        {/* The money the report cannot see, in the app's money colours: in
            green, out red, and the NET of the two — the single number that
            says how far the report's totals could move once filed. */}
        <span className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm font-semibold tabular-nums">
          <span className="text-green-600 dark:text-green-400">
            {formatCurrency(flows.uncategorizedIn.toNumber())} in
          </span>
          <span className="text-red-600 dark:text-red-400">
            {formatCurrency(flows.uncategorizedOut.toNumber())} out
          </span>
          {/* The net wears a subtle bordered chip: it is the one figure that
              says how far these totals could move, so it stands apart from
              the two components it nets. */}
          {(() => {
            const net = flows.uncategorizedIn.minus(flows.uncategorizedOut);
            if (net.isZero()) {
              return (
                <span className="px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400">
                  nets to zero
                </span>
              );
            }
            const chip = net.isNegative()
              ? 'border-red-300 dark:border-red-600/70 text-red-600 dark:text-red-400'
              : 'border-green-300 dark:border-green-600/70 text-green-600 dark:text-green-400';
            return (
              <span className={`px-2 py-0.5 rounded-md border ${chip}`}>
                {formatCurrency(net.abs().toNumber())} net {net.isNegative() ? 'out' : 'in'}
              </span>
            );
          })()}
        </span>
        <span className="ml-auto text-xs text-amber-700 dark:text-amber-400">
          Click to review and categorise
        </span>
      </button>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setShowTransferSweep(true)}
          className="text-sm text-blue-700 dark:text-blue-400 hover:underline text-left"
        >
          Or match transfers automatically — find equal-and-opposite pairs and link them in one go
        </button>
        <button
          type="button"
          onClick={() => setShowBulkCategorize(true)}
          className="text-sm text-blue-700 dark:text-blue-400 hover:underline text-left"
        >
          Or categorise by payee — file a whole merchant at once and teach future imports
        </button>
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />

      <TransferSweepModal isOpen={showTransferSweep} onClose={() => setShowTransferSweep(false)} />
      <BulkCategorizeModal isOpen={showBulkCategorize} onClose={() => setShowBulkCategorize(false)} />
    </div>
  );
}
