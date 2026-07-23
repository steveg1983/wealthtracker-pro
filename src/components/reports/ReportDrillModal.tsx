import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
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
  const { transactions } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);

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
