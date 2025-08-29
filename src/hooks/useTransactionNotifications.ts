import { useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useNotifications } from '../contexts/NotificationContext';
import type { Transaction } from '../types';

interface UseTransactionNotificationsReturn {
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

export function useTransactionNotifications(): UseTransactionNotificationsReturn {
  const { addTransaction: originalAddTransaction, transactions } = useApp();
  const { checkLargeTransaction, checkEnhancedTransactionAlerts } = useNotifications();

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    // Create the full transaction object with ID
    const fullTransaction: Transaction = {
      ...transaction,
      id: `transaction-${Date.now()}`
    };

    // Add the transaction first
    originalAddTransaction(transaction);
    
    // Check for enhanced transaction alerts (includes duplicate detection, unusual spending, etc.)
    checkEnhancedTransactionAlerts(fullTransaction, transactions);
    
    // Legacy check for large transactions (keeping for backward compatibility)
    if (transaction.type === 'expense') {
      checkLargeTransaction(transaction.amount, transaction.description);
    }
  }, [originalAddTransaction, checkLargeTransaction, checkEnhancedTransactionAlerts, transactions]);

  return { addTransaction };
}