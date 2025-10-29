import React, { useState, useMemo, useCallback } from 'react';
import { 
  CheckCircleIcon, 
  XIcon, 
  ArrowRightIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  RefreshCwIcon
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Transaction, Account } from '../types';

interface SimplifiedReconciliationProps {
  account: Account;
  onClose: () => void;
}

/**
 * Simplified Account Balance Reconciliation
 * Design principles:
 * 1. One-step reconciliation process
 * 2. Clear visual feedback
 * 3. Bulk actions for efficiency
 * 4. Mobile-friendly interface
 * 5. Smart matching suggestions
 */
export function SimplifiedReconciliation({ account, onClose }: SimplifiedReconciliationProps): React.JSX.Element {
  const { transactions, updateTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [targetBalance, setTargetBalance] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  // Get uncleared transactions for this account
  const unclearedTransactions = useMemo(() => 
    transactions
      .filter(t => t.accountId === account.id && !t.cleared)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions, account.id]
  );

  // Calculate current balance (all transactions)
  const currentBalance = useMemo(() => {
    return transactions
      .filter(t => t.accountId === account.id)
      .reduce((sum, t) => {
        if (account.type === 'liability') {
          return sum - t.amount; // Liabilities are negative
        }
        return sum + t.amount;
      }, 0);
  }, [transactions, account]);

  // Calculate selected transactions total
  const selectedTotal = useMemo(() => {
    return Array.from(selectedTransactions).reduce((sum, id) => {
      const transaction = unclearedTransactions.find(t => t.id === id);
      if (!transaction) return sum;
      return sum + transaction.amount;
    }, 0);
  }, [selectedTransactions, unclearedTransactions]);

  // Calculate what the balance would be after reconciliation
  const projectedBalance = currentBalance - 
    unclearedTransactions
      .filter(t => !selectedTransactions.has(t.id))
      .reduce((sum, t) => sum + t.amount, 0);

  // Toggle transaction selection
  const toggleTransaction = useCallback((id: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Select all transactions
  const selectAll = useCallback(() => {
    setSelectedTransactions(new Set(unclearedTransactions.map(t => t.id)));
  }, [unclearedTransactions]);

  // Deselect all transactions
  const deselectAll = useCallback(() => {
    setSelectedTransactions(new Set());
  }, []);

  // Auto-select transactions to match target balance
  const autoMatch = useCallback(() => {
    if (!targetBalance) return;
    
    const target = parseFloat(targetBalance);
    const transactionsToSelect: string[] = [];
    let runningTotal = currentBalance;
    
    // Try to find combination that matches target
    for (const transaction of unclearedTransactions) {
      const newTotal = runningTotal - transaction.amount;
      if (Math.abs(newTotal - target) < Math.abs(runningTotal - target)) {
        transactionsToSelect.push(transaction.id);
        runningTotal = newTotal;
      }
      
      // Stop if we've reached the target
      if (Math.abs(runningTotal - target) < 0.01) break;
    }
    
    setSelectedTransactions(new Set(transactionsToSelect));
  }, [targetBalance, currentBalance, unclearedTransactions]);

  // Perform reconciliation
  const reconcile = useCallback(async () => {
    setIsReconciling(true);
    
    try {
      // Mark selected transactions as cleared
      const promises = Array.from(selectedTransactions).map(id => {
        const transaction = transactions.find(t => t.id === id);
        if (transaction) {
          return updateTransaction(id, { ...transaction, cleared: true });
        }
        return Promise.resolve();
      });
      
      await Promise.all(promises);
      
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Reconciliation failed:', error);
    } finally {
      setIsReconciling(false);
    }
  }, [selectedTransactions, transactions, updateTransaction, onClose]);

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center">
          <CheckCircleIcon size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Reconciliation Complete!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedTransactions.size} transactions marked as cleared
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Reconcile {account.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {unclearedTransactions.length} uncleared transactions
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Balance Summary */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(currentBalance)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">After Reconciliation</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(projectedBalance)}
              </p>
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Target Balance (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={targetBalance}
                  onChange={(e) => setTargetBalance(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  onClick={autoMatch}
                  disabled={!targetBalance}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Auto-select transactions to match target"
                >
                  <RefreshCwIcon size={16} />
                </button>
              </div>
            </div>
          </div>
          
          {targetBalance && Math.abs(parseFloat(targetBalance) - projectedBalance) > 0.01 && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircleIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Difference of {formatCurrency(Math.abs(parseFloat(targetBalance) - projectedBalance))} from target
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTransactions.size} of {unclearedTransactions.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-6">
          {unclearedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircleIcon size={48} className="text-green-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                All transactions are already reconciled!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {unclearedTransactions.map(transaction => {
                const isSelected = selectedTransactions.has(transaction.id);
                
                return (
                  <div
                    key={transaction.id}
                    onClick={() => toggleTransaction(transaction.id)}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center
                          ${isSelected 
                            ? 'bg-blue-600 border-blue-600' 
                            : 'border-gray-300 dark:border-gray-600'
                          }
                        `}>
                          {isSelected && <CheckCircleIcon size={14} className="text-white" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {transaction.description}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p className={`font-semibold ${
                        transaction.type === 'income' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selected Total: <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(selectedTotal)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={reconcile}
                disabled={selectedTransactions.size === 0 || isReconciling}
                className="px-6 py-2 bg-primary hover:bg-secondary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isReconciling ? (
                  <>
                    <RefreshCwIcon size={16} className="animate-spin" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    Mark as Cleared
                    <ArrowRightIcon size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}