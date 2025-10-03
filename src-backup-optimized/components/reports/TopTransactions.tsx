import React, { useEffect, memo } from 'react';
import type { Transaction } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface TopTransactionsProps {
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
  getTransactionColor: (type: 'income' | 'expense') => string;
}

const TopTransactions = memo(function TopTransactions({ transactions,
  formatCurrency,
  getTransactionColor
 }: TopTransactionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TopTransactions component initialized', {
      componentName: 'TopTransactions'
    });
  }, []);
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Top Transactions</h2>
      </div>
      
      {/* Mobile card view */}
      <MobileTransactionView
        transactions={transactions}
        formatCurrency={formatCurrency}
        getTransactionColor={getTransactionColor}
      />
      
      {/* Desktop table view */}
      <DesktopTransactionView
        transactions={transactions}
        formatCurrency={formatCurrency}
        getTransactionColor={getTransactionColor}
      />
    </div>
  );
});

// Mobile Transaction View Sub-component
const MobileTransactionView = memo(function MobileTransactionView({
  transactions,
  formatCurrency,
  getTransactionColor
}: TopTransactionsProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="block sm:hidden">
      <div className="space-y-3 p-4">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.category}</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
              </div>
              <p className={`text-lg font-semibold ${transaction.type === 'transfer' ? 'text-blue-600' : getTransactionColor(transaction.type)}`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Desktop Transaction View Sub-component
const DesktopTransactionView = memo(function DesktopTransactionView({
  transactions,
  formatCurrency,
  getTransactionColor
}: TopTransactionsProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Description</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Category</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                {new Date(transaction.date).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                {transaction.description}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                {transaction.category}
              </td>
              <td className={`px-4 py-3 text-sm text-right font-medium ${transaction.type === 'transfer' ? 'text-blue-600' : getTransactionColor(transaction.type)}`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default TopTransactions;