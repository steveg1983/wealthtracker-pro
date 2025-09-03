import React from 'react';
import type { Transaction } from '../../types';

interface MobileTransactionListProps {
  transactions: Transaction[];
  onView: (transaction: Transaction) => void;
}

/**
 * Mobile-optimized transaction list
 * - Read-only focus
 * - Summary information
 * - Touch-friendly
 * - Quick actions only
 */
export const MobileTransactionList: React.FC<MobileTransactionListProps> = ({
  transactions,
  onView
}) => {
  // Group transactions by date for better mobile viewing
  const groupedTransactions = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="mobile-transaction-list">
      <div className="px-4 py-3 bg-white dark:bg-gray-800 sticky top-0 z-10 border-b">
        <h2 className="text-lg font-semibold">Recent Transactions</h2>
        <p className="text-sm text-gray-500">Tap to view details</p>
      </div>
      
      <div className="divide-y">
        {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
          <div key={date}>
            <div className="px-4 py-2 bg-blue-50 dark:bg-gray-900 text-sm font-medium text-gray-600">
              {date}
            </div>
            {dayTransactions.map(transaction => (
              <div
                key={transaction.id}
                onClick={() => onView(transaction)}
                className="px-4 py-3 bg-white dark:bg-gray-800 active:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {transaction.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.amount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {transaction.accountId}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Mobile-specific floating action button */}
      <div className="fixed bottom-20 right-4">
        <button className="bg-gray-600 text-white rounded-full p-4 shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
};