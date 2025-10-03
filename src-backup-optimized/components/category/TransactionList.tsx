/**
 * Transaction List Component
 * Displays list of category transactions
 */

import React, { useEffect } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { categoryTransactionsModalService } from '../../services/categoryTransactionsModalService';
import type { Transaction } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface TransactionListProps {
  transactions: Transaction[];
  getAccountName: (transaction: Transaction) => string;
}

const TransactionList = React.memo(({ transactions, getAccountName }: TransactionListProps) => {
  const { formatCurrency } = useCurrencyDecimal();

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No transactions found
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {transactions.map((transaction) => {
        const isIncome = categoryTransactionsModalService.isIncome(transaction);
        
        return (
          <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>{categoryTransactionsModalService.formatTransactionDate(transaction.date)}</span>
                      <span>{getAccountName(transaction)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        isIncome
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                      }`}>
                        {categoryTransactionsModalService.getTransactionTypeLabel(transaction.type)}
                      </span>
                    </div>
                    {transaction.notes && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {transaction.notes}
                      </p>
                    )}
                    {transaction.tags && transaction.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {transaction.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <p className={`font-semibold ${
                      isIncome
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

TransactionList.displayName = 'TransactionList';

export default TransactionList;