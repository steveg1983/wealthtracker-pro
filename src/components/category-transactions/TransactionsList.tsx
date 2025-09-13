/**
 * Transactions List Component
 * Display list of filtered transactions
 */

import React, { useEffect, memo } from 'react';
import type { Transaction, Account } from '../../types';
import { logger } from '../../services/loggingService';

interface TransactionsListProps {
  transactions: Transaction[];
  accounts: Account[];
  formatCurrency: (amount: number) => string;
  searchQuery: string;
}

export const TransactionsList = memo(function TransactionsList({
  transactions,
  accounts,
  formatCurrency,
  searchQuery
}: TransactionsListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('TransactionsList component initialized', {
        transactionCount: transactions.length,
        searchQuery: searchQuery || 'none',
        componentName: 'TransactionsList'
      });
    } catch (error) {
      logger.error('TransactionsList initialization failed:', error, 'TransactionsList');
    }
  }, [transactions.length, searchQuery]);
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          {searchQuery ? `No transactions matching "${searchQuery}"` : 
           'No matching transactions found'}
        </p>
        {searchQuery && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Try searching for partial words, amounts, or account names
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {searchQuery && (
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}
      <div className="space-y-2">
        {transactions.map(transaction => {
          try {
            const account = accounts.find(a => a.id === transaction.accountId);
            const isIncome = transaction.type === 'income' || 
                            (transaction.type === 'transfer' && transaction.amount > 0);
            
            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.description || 'No description'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {(() => {
                          try {
                            return new Date(transaction.date).toLocaleDateString();
                          } catch (dateError) {
                            logger.error('Failed to format transaction date:', dateError, 'TransactionsList');
                            return 'Invalid date';
                          }
                        })()} • {account?.name || 'Unknown Account'}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-medium ${
                        isIncome
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {(() => {
                          try {
                            const amount = transaction.amount || 0;
                            return `${amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
                          } catch (formatError) {
                            logger.error('Failed to format transaction amount:', formatError, 'TransactionsList');
                            return 'Amount error';
                          }
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {transaction.type === 'transfer' 
                          ? `transfer (${transaction.amount > 0 ? 'in' : 'out'})` 
                          : transaction.type || 'unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          } catch (error) {
            logger.error('Failed to render transaction:', { error, transactionId: transaction.id }, 'TransactionsList');
            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700"
              >
                <div className="flex-1">
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Error displaying transaction
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                    Transaction ID: {transaction.id || 'unknown'}
                  </p>
                </div>
              </div>
            );
          }
        })}
      </div>
    </>
  );
});
