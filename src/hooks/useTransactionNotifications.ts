import { useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useNotifications } from '../contexts/NotificationContext';
import type { Transaction } from '../types';

interface UseTransactionNotificationsReturn {
  /**
   * Adds the row and raises whatever alerts it deserves, and hands back THE
   * ROW THAT WAS WRITTEN — see the note on the context's own addTransaction.
   * A caller that has to do something with the new id (creating the other half
   * of a transfer, for one) must not be forced around this wrapper and lose
   * the alerts to get it.
   */
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction>;
}

export function useTransactionNotifications(): UseTransactionNotificationsReturn {
  const { addTransaction: originalAddTransaction, transactions } = useApp();
  const { checkLargeTransaction, checkEnhancedTransactionAlerts } = useNotifications();

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    // Awaited so a failed write propagates to the caller (the edit modal shows
    // it as a submit error) instead of vanishing.
    const created = await originalAddTransaction(transaction);

    // Check for enhanced transaction alerts (includes duplicate detection,
    // unusual spending, etc.) — against the STORED row, not a stand-in built
    // from a clock reading. The duplicate check compares ids, and an id no row
    // has is one it can never match.
    checkEnhancedTransactionAlerts(created, transactions);

    // Legacy check for large transactions (keeping for backward compatibility)
    if (transaction.type === 'expense') {
      // Expenses are stored signed (negative); the threshold expects a positive magnitude
      checkLargeTransaction(Math.abs(transaction.amount), transaction.description);
    }
    return created;
  }, [originalAddTransaction, checkLargeTransaction, checkEnhancedTransactionAlerts, transactions]);

  return { addTransaction };
}