import { useState, useCallback, useEffect } from 'react';
import { useOfflineData } from './useOffline';
import { offlineService } from '../services/offlineService';
import type { Transaction } from '../types';

export function useOfflineTransactions(accountId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { save, update, remove, isOffline } = useOfflineData({ 
    entity: 'transaction' 
  });

  // Load transactions
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (isOffline) {
        // Load from offline store
        const offlineTransactions = await offlineService.getTransactions(accountId);
        setTransactions(offlineTransactions);
      } else {
        // Load from API
        const params = accountId ? `?accountId=${accountId}` : '';
        const response = await fetch(`/api/transactions${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to load transactions');
        }
        
        const data = await response.json();
        setTransactions(data);
        
        // Also save to offline store for caching
        for (const transaction of data) {
          await offlineService.saveTransaction(transaction, false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
      
      // Try to load from offline store as fallback
      try {
        const offlineTransactions = await offlineService.getTransactions(accountId);
        setTransactions(offlineTransactions);
      } catch {
        // Ignore fallback error
      }
    } finally {
      setIsLoading(false);
    }
  }, [accountId, isOffline]);

  // Initial load
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Create transaction
  const createTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `temp-${Date.now()}`, // Temporary ID for offline transactions
    };
    
    // Optimistically update UI
    setTransactions(prev => [...prev, newTransaction]);
    
    try {
      await save(newTransaction);
      
      if (!isOffline) {
        // If online, the API will return the real transaction with server ID
        // We should update our local copy
        await loadTransactions();
      }
    } catch (err) {
      // Revert optimistic update on error
      setTransactions(prev => prev.filter(t => t.id !== newTransaction.id));
      throw err;
    }
  }, [save, isOffline, loadTransactions]);

  // Update transaction
  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    // Optimistically update UI
    setTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
    
    try {
      await update(id, updates);
    } catch (err) {
      // Revert optimistic update on error
      await loadTransactions();
      throw err;
    }
  }, [update, loadTransactions]);

  // Delete transaction
  const deleteTransaction = useCallback(async (id: string) => {
    // Optimistically update UI
    setTransactions(prev => prev.filter(t => t.id !== id));
    
    try {
      await remove(id);
    } catch (err) {
      // Revert optimistic update on error
      await loadTransactions();
      throw err;
    }
  }, [remove, loadTransactions]);

  return {
    transactions,
    isLoading,
    error,
    isOffline,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refresh: loadTransactions,
  };
}