import { useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useNotifications } from '../contexts/NotificationContext';
import type { Transaction } from '../types';

interface UseTransactionNotificationsReturn {
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
}

export function useTransactionNotifications(): UseTransactionNotificationsReturn {
  const { addTransaction: originalAddTransaction, transactions } = useApp();
  const { checkLargeTransaction, checkEnhancedTransactionAlerts } = useNotifications();

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    // Create the full transaction object with ID
    const fullTransaction: Transaction = {
      ...transaction,
      id: `transaction-${Date.now()}`
    };

    // Add the transaction first — awaited so a failed write propagates to the
    // caller (the edit modal shows it as a submit error) instead of vanishing.
    await originalAddTransaction(transaction);

    // Check for enhanced transaction alerts (includes duplicate detection, unusual spending, etc.)
    checkEnhancedTransactionAlerts(fullTransaction, transactions);
    
    // Legacy check for large transactions (keeping for backward compatibility)
    if (transaction.type === 'expense') {
      // Expenses are stored signed (negative); the threshold expects a positive magnitude
      checkLargeTransaction(Math.abs(transaction.amount), transaction.description);
    }
  }, [originalAddTransaction, checkLargeTransaction, checkEnhancedTransactionAlerts, transactions]);

  return { addTransaction };
}