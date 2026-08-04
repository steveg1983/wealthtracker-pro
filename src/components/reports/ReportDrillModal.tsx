import React, { useCallback, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useToast } from '../../contexts/ToastContext';
import IncomeExpenseBreakdownModal, { type BreakdownBucket } from '../IncomeExpenseBreakdownModal';
import EditTransactionModal from '../EditTransactionModal';
import type { Category } from '../../types';
import type { SplitExpandedTransaction } from '../../utils/transactionSplits';

/**
 * Every figure in the gallery drills into the transactions behind it — a
 * chart slice, a matrix cell, a payee row, an account balance. This is that
 * drill-in, once: the shared breakdown list, plus the editor a row opens.
 *
 * Reports raise a target and clear it; nothing else about the mechanism has
 * to be repeated in each report.
 */
export interface ReportDrillTarget {
  title: string;
  bucket: BreakdownBucket;
  rows: SplitExpandedTransaction[];
  /** The figure the rows sum to; null hides the total line. */
  total: number | null;
}

export default function ReportDrillModal({
  target,
  onClose,
  categories,
}: {
  target: ReportDrillTarget | null;
  onClose: () => void;
  categories: Category[];
}): React.JSX.Element {
  const { transactions, applyCategoryToUncategorized } = useApp();
  const { showSuccess, showError } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  // The uncategorised drill files rows inline in batches: one call per
  // distinct category, blanks-only underneath, so a concurrent edit can
  // never be overwritten. Errors surface AND rethrow — the modal keeps the
  // user's un-saved choices when a save fails.
  const handleApplyCategories = useCallback(
    async (assignments: Map<string, string[]>): Promise<number> => {
      try {
        let updated = 0;
        for (const [categoryId, ids] of assignments) {
          updated += await applyCategoryToUncategorized(ids, categoryId);
        }
        showSuccess(
          `${updated.toLocaleString()} transaction${updated === 1 ? '' : 's'} categorised.`,
          'Categories applied'
        );
        return updated;
      } catch (error) {
        showError(error);
        throw error;
      }
    },
    [applyCategoryToUncategorized, showSuccess, showError]
  );

  return (
    <>
      <IncomeExpenseBreakdownModal
        isOpen={target !== null}
        onClose={onClose}
        title={target?.title ?? ''}
        bucket={target?.bucket ?? 'neutral'}
        rows={target?.rows ?? []}
        total={target?.total ?? null}
        categories={categories}
        onEditTransaction={setEditingId}
        onApplyCategories={target?.bucket === 'uncategorized' ? handleApplyCategories : undefined}
      />

      {/* A split line's editor opens its PARENT — that is the real record. */}
      {editingId !== null && (
        <EditTransactionModal
          isOpen
          onClose={() => setEditingId(null)}
          transaction={transactions.find(t => t.id === editingId) ?? null}
        />
      )}
    </>
  );
}
