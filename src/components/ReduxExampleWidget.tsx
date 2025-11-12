import React from 'react';
import { useAppSelector } from '../store';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

/**
 * Example widget that demonstrates using Redux selectors
 * instead of context hooks
 */
export function ReduxExampleWidget() {
  const { formatCurrency } = useCurrencyDecimal();
  
  // Using Redux selectors instead of useApp()
  const accounts = useAppSelector(state => state.accounts.accounts);
  const transactions = useAppSelector(state => state.transactions.transactions);
  
  // Calculate total balance using Redux data
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const transactionCount = transactions.length;
  
  return (
    <div className="p-4 bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2 dark:text-white">Redux Example</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Total Balance:</span>
          <span className="font-medium dark:text-white">{formatCurrency(totalBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
          <span className="font-medium dark:text-white">{transactionCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Accounts:</span>
          <span className="font-medium dark:text-white">{accounts.length}</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        This widget uses Redux instead of Context API
      </p>
    </div>
  );
}