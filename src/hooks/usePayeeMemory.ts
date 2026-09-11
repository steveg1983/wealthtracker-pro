import { useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { findSamePayeeUncategorized } from '../utils/payeeAutoCategorize';
import { categoryIdIsTransferFiling } from '../utils/transferCoherence';
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
  const { transactions, categories, suggestCategoryToUncategorized } = useApp();
  const { showSuccess } = useToast();
  const logger = useMemo(() => createScopedLogger('usePayeeMemory'), []);

  const propagateCategory = useCallback(async ({ accountId, description, type, categoryId, excludeId }: {
    accountId: string;
    description: string;
    type: 'income' | 'expense';
    categoryId: string;
    excludeId?: string;
  }) => {
    /**
     * A transfer category never spreads.
     *
     * Payee memory's whole premise is that a payee's category is a HABIT worth
     * repeating. A transfer is not: it is a movement between two named
     * accounts, and repeating one means creating a counterpart row in another
     * account for every match — inventing movements nobody recorded. The
     * conversion flow exists precisely because each transfer needs its target
     * resolved on its own.
     *
     * Stopped HERE rather than left to the refusal in
     * applyCategoryToUncategorized, and silently, because this fan-out is a
     * courtesy nobody asked for: the user saved ONE row, and an error toast
     * about a bulk write they never requested would be the app complaining
     * about its own idea. The deliberate bulk screens get the message; this
     * gets a no-op.
     */
    if (categoryIdIsTransferFiling(categories, categoryId)) {
      return;
    }
    const targets = findSamePayeeUncategorized(transactions, accountId, description, type, excludeId);
    if (targets.length === 0) {
      return;
    }
    try {
      // A SUGGESTION, not a filing (the owner's ruling, 11 Sep 2026): he
      // confirmed one row and the fan-out filed the payee's other rows off
      // the review list unseen. The spread is welcome; the vouching was not.
      // These rows stay in To Review wearing the Suggested badge until he
      // answers for each one — or picks a different category for the odd one
      // out, which is the whole reason they must still be on the list.
      const suggestedCount = await suggestCategoryToUncategorized(targets, categoryId);
      if (suggestedCount > 0) {
        const categoryName = categories.find(c => c.id === categoryId)?.name ?? 'this category';
        showSuccess(
          `Also suggested "${categoryName}" for ${suggestedCount} other "${description}" transaction${suggestedCount === 1 ? '' : 's'} — still in To Review for you to confirm.`,
          'Payee memory'
        );
      }
    } catch (error) {
      logger.error('Payee-memory propagation failed', error as Error);
    }
  }, [transactions, categories, suggestCategoryToUncategorized, showSuccess, logger]);

  return { propagateCategory };
}
