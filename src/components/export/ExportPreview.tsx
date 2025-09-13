import React, { useEffect, memo } from 'react';
import { format } from 'date-fns';
import { EyeIcon } from '../icons';
import type { ExportOptions } from '../../config/exportTemplates';
import type { Transaction } from '../../types';
import { logger } from '../../services/loggingService';

interface ExportPreviewProps {
  options: ExportOptions;
  transactions: Transaction[];
  dateRange: { start: Date; end: Date };
  onClose: () => void;
}

export const ExportPreview = memo(function ExportPreview({
  options,
  transactions,
  dateRange,
  onClose
}: ExportPreviewProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ExportPreview component initialized', {
      componentName: 'ExportPreview'
    });
  }, []);

  // Filter transactions based on options
  const filteredTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= dateRange.start && 
           transactionDate <= dateRange.end &&
           (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
           (options.categories.length === 0 || options.categories.includes(t.category));
  });

  // Calculate summary statistics
  const income = filteredTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = Math.abs(filteredTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <EyeIcon className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Preview</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 p-4 rounded-lg mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {options.customTitle || 'Financial Report'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}
            </p>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400">Total Income</p>
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                £{income.toFixed(2)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400">Total Expenses</p>
              <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                £{expenses.toFixed(2)}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400">Net Amount</p>
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                £{(income - expenses).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Transactions</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {filteredTransactions.length}
              </p>
            </div>
          </div>

          {/* Transaction List Preview */}
          {options.reportType === 'transactions' && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Transaction Details</h3>
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {filteredTransactions.slice(0, 10).map((t, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="p-2">{format(new Date(t.date), 'MMM d')}</td>
                        <td className="p-2">{t.description}</td>
                        <td className="p-2">{t.category}</td>
                        <td className={`p-2 text-right font-medium ${
                          t.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          £{Math.abs(t.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTransactions.length > 10 && (
                  <div className="p-2 text-center text-sm text-gray-500 dark:text-gray-400">
                    ... and {filteredTransactions.length - 10} more transactions
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export Settings */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Export Settings</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Format:</span> 
                <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                  {options.format.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Group By:</span>
                <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                  {options.groupBy}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Include Charts:</span>
                <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                  {options.includeCharts ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Paper Size:</span>
                <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                  {options.paperSize.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
});