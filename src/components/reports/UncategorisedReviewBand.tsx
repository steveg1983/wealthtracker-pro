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
      {/* NEUTRAL band, semantic figures, ONE link colour (Design, 23 Aug §2).
          The first draft carried five signals in one strip — amber border and
          tint, a green, a red, a red-BORDERED box around the net (a piece of
          furniture nothing else in the app has), and an amber link over two
          blue ones. The exclusion is information, not an alarm: the container
          is the house card surface, the three figures keep the money colours
          they'd have anywhere else (no box — the "net" label already sets the
          figure apart), a zero net wears no colour at all, and all three
          routes to the same job speak in the one link colour. */}
      <button
        type="button"
        onClick={() => setDrill({
          title: 'Uncategorised Transactions',
          bucket: 'uncategorized',
          rows: flows.uncategorizedRows,
          total: null,
        })}
        className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
          {(() => {
            const net = flows.uncategorizedIn.minus(flows.uncategorizedOut);
            if (net.isZero()) {
              // A zero asks for no attention, so it wears no colour.
              return (
                <span className="text-gray-500 dark:text-gray-400">nets to zero</span>
              );
            }
            const tone = net.isNegative()
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400';
            return (
              <span className={tone}>
                {formatCurrency(net.abs().toNumber())} net {net.isNegative() ? 'out' : 'in'}
              </span>
            );
          })()}
        </span>
        {/* The one link colour is the app's OWN in-app link ink, not the stock
            blue it borrowed — these three go to another screen inside the app,
            which is what `text-primary` is for (stock-blue ruling, 28 Aug 2026). */}
        <span className="ml-auto text-xs text-primary">
          Click to review and categorise
        </span>
      </button>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setShowTransferSweep(true)}
          className="text-sm text-primary hover:text-secondary hover:underline text-left"
        >
          Or match transfers automatically — find equal-and-opposite pairs and link them in one go
        </button>
        <button
          type="button"
          onClick={() => setShowBulkCategorize(true)}
          className="text-sm text-primary hover:text-secondary hover:underline text-left"
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
