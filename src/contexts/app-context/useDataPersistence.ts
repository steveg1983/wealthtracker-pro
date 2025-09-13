import { useEffect, useCallback } from 'react';
import { storageAdapter, STORAGE_KEYS } from '../../services/storageAdapter';
import { logger } from '../../services/loggingService';
import type { Account, Transaction, Budget, Goal } from '../../types';
import type { DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal } from '../../types/decimal-types';
import type { Category, Tag, RecurringTransaction } from './types';
import { fromDecimalAccount, fromDecimalTransaction, fromDecimalBudget, fromDecimalGoal } from '../../utils/decimal-converters';
import type { DecimalInstance } from '../../utils/decimal';
import { toDecimal } from '../../utils/decimal';

// Internal Decimal version of RecurringTransaction
interface DecimalRecurringTransaction extends Omit<RecurringTransaction, 'amount'> {
  amount: DecimalInstance;
}

function fromDecimalRecurringTransaction(recurring: DecimalRecurringTransaction): RecurringTransaction {
  return {
    ...recurring,
    amount: recurring.amount.toNumber()
  };
}

/**
 * Custom hook for data persistence operations
 * Handles saving and loading data from secure storage
 */
export function useDataPersistence(
  isStorageReady: boolean,
  decimalTransactions: DecimalTransaction[],
  decimalAccounts: DecimalAccount[],
  decimalBudgets: DecimalBudget[],
  decimalGoals: DecimalGoal[],
  categories: Category[],
  tags: Tag[],
  decimalRecurringTransactions: DecimalRecurringTransaction[]
) {
  // Save data to secure storage whenever it changes
  useEffect(() => {
    if (!isStorageReady) return;
    
    const saveData = async () => {
      try {
        // Convert Decimal types back to regular types for storage
        const transactions = decimalTransactions.map(fromDecimalTransaction);
        const accounts = decimalAccounts.map(fromDecimalAccount);
        const budgets = decimalBudgets.map(fromDecimalBudget);
        const goals = decimalGoals.map(fromDecimalGoal);
        const recurringTransactions = decimalRecurringTransactions.map(fromDecimalRecurringTransaction);
        
        await Promise.all([
          storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions),
          storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts),
          storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets),
          storageAdapter.set(STORAGE_KEYS.GOALS, goals),
          storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories),
          storageAdapter.set(STORAGE_KEYS.TAGS, tags),
          storageAdapter.set(STORAGE_KEYS.RECURRING_TRANSACTIONS, recurringTransactions)
        ]);
      } catch (error) {
        logger.error('Failed to save data:', error);
      }
    };
    
    // Debounce saves to avoid excessive writes
    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [
    isStorageReady,
    decimalTransactions,
    decimalAccounts,
    decimalBudgets,
    decimalGoals,
    categories,
    tags,
    decimalRecurringTransactions
  ]);

  const clearAllData = useCallback(async (): Promise<void> => {
    try {
      await Promise.all([
        storageAdapter.remove(STORAGE_KEYS.TRANSACTIONS),
        storageAdapter.remove(STORAGE_KEYS.ACCOUNTS),
        storageAdapter.remove(STORAGE_KEYS.BUDGETS),
        storageAdapter.remove(STORAGE_KEYS.GOALS),
        storageAdapter.remove(STORAGE_KEYS.CATEGORIES),
        storageAdapter.remove(STORAGE_KEYS.TAGS),
        storageAdapter.remove(STORAGE_KEYS.RECURRING_TRANSACTIONS)
      ]);
      await storageAdapter.set('wealthtracker_data_cleared', true);
    } catch (error) {
      logger.error('Failed to clear data:', error);
      throw error;
    }
  }, []);

  const exportData = useCallback((): string => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      accounts: decimalAccounts.map(fromDecimalAccount),
      transactions: decimalTransactions.map(fromDecimalTransaction),
      budgets: decimalBudgets.map(fromDecimalBudget),
      goals: decimalGoals.map(fromDecimalGoal),
      categories,
      tags,
      recurringTransactions: decimalRecurringTransactions.map(fromDecimalRecurringTransaction)
    };
    return JSON.stringify(data, null, 2);
  }, [
    decimalAccounts,
    decimalTransactions,
    decimalBudgets,
    decimalGoals,
    categories,
    tags,
    decimalRecurringTransactions
  ]);

  return {
    clearAllData,
    exportData
  };
}