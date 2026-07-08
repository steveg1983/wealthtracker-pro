import { useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { findSamePayeeUncategorized } from '../utils/payeeAutoCategorize';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * Payee memory (the Microsoft Money model): when a transaction gets a
 * category, spread it to every UNCATEGORIZED same-direction transaction with
 * the same payee in that account. Explicit categories are never overwritten
 * (enforced server-side too), and a propagation failure never fails the save
 * that already succeeded — it is logged and swallowed.
 */
export function usePayeeMemory(): {
  propagateCategory: (args: {
    accountId: string;
    description: string;
    type: 'income' | 'expense';
    categoryId: string;
    excludeId?: string;
  }) => Promise<void>;
} {
  const { transactions, categories, applyCategoryToUncategorized } = useApp();
  const { showSuccess } = useToast();
  const logger = useMemo(() => createScopedLogger('usePayeeMemory'), []);

  const propagateCategory = useCallback(async ({ accountId, description, type, categoryId, excludeId }: {
    accountId: string;
    description: string;
    type: 'income' | 'expense';
    categoryId: string;
    excludeId?: string;
  }) => {
    const targets = findSamePayeeUncategorized(transactions, accountId, description, type, excludeId);
    if (targets.length === 0) {
      return;
    }
    try {
      const appliedCount = await applyCategoryToUncategorized(targets, categoryId);
      if (appliedCount > 0) {
        const categoryName = categories.find(c => c.id === categoryId)?.name ?? 'this category';
        showSuccess(
          `Also applied "${categoryName}" to ${appliedCount} other "${description}" transaction${appliedCount === 1 ? '' : 's'}.`,
          'Payee memory'
        );
      }
    } catch (error) {
      logger.error('Payee-memory propagation failed', error as Error);
    }
  }, [transactions, categories, applyCategoryToUncategorized, showSuccess, logger]);

  return { propagateCategory };
}
