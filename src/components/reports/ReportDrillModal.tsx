import React, { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useToast } from '../../contexts/ToastContext';
import IncomeExpenseBreakdownModal, { type BreakdownBucket } from '../IncomeExpenseBreakdownModal';
import EditTransactionModal from '../EditTransactionModal';
import { expandSplitTransactions, type SplitExpandedTransaction } from '../../utils/transactionSplits';
import type { Category } from '../../types';
import { formatCount } from '../../utils/localeFormat';

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
  /**
   * WHICH rows the drill shows. A target is a snapshot taken when it was
   * raised, so these rows carry their data as it was THEN; only their
   * identity is used — the data is re-read from context on every render.
   */
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
  const { transactions, transactionSplits, applyCategoryToUncategorized } = useApp();
  const { showSuccess, showError } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  /**
   * The rows as they are NOW. The target names which rows to show; each one's
   * data is re-derived from context every render, so an edit made from inside
   * the drill (the editor a row opens) or anywhere else shows here at once
   * instead of the list keeping the copy it was opened with.
   *
   * Rows are matched by id — a split line's synthetic id survives a
   * re-categorisation, because the writer matches lines by identity — so a row
   * that can no longer be found has genuinely gone (deleted, or a split line
   * removed) and drops. Which rows still BELONG in the bucket is the breakdown
   * list's rule, applied there for every host that shows one.
   */
  const liveRows = useMemo<SplitExpandedTransaction[]>(() => {
    if (target === null) return [];
    const wanted = new Set(target.rows.map(row => row.splitParentId ?? row.id));
    const parents = transactions.filter(t => wanted.has(t.id));
    const byId = new Map<string, SplitExpandedTransaction>(
      expandSplitTransactions(parents, transactionSplits).map(row => [row.id, row])
    );
    // An account drill lists the REAL transactions, unexpanded, where a split
    // parent is a row in its own right — so it stays findable by its own id.
    // The uncategorised chore list is the EXPANDED view (its rows come from
    // computeIncomeExpense), where a parent is replaced by its lines: a row
    // that has just become a split must drop there exactly as it does on the
    // page behind it.
    if (target.bucket !== 'uncategorized') {
      for (const parent of parents) {
        if (!byId.has(parent.id)) byId.set(parent.id, parent);
      }
    }
    return target.rows
      .map(row => byId.get(row.id))
      .filter((row): row is SplitExpandedTransaction => row !== undefined);
  }, [target, transactions, transactionSplits]);

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
          `${formatCount(updated)} transaction${updated === 1 ? '' : 's'} categorised.`,
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
        rows={liveRows}
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
