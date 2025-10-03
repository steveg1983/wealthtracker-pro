import React, { useEffect, memo } from 'react';
import { CheckIcon, XIcon, AlertCircleIcon } from '../icons';
import type { Transaction } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface PreviewStepProps {
  transactions: Partial<Transaction>[];
  duplicates: number;
  errors: string[];
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string) => string;
}

export const PreviewStep = memo(function PreviewStep({ transactions,
  duplicates,
  errors,
  formatCurrency,
  formatDate
 }: PreviewStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PreviewStep component initialized', {
      componentName: 'PreviewStep'
    });
  }, []);

  const validTransactions = transactions.filter(t => 
    t.date && t.amount !== undefined && t.description
  );

  const getAmountColor = (amount: number | undefined, type?: string) => {
    if (amount === undefined) return 'text-gray-500';
    if (type === 'income' || amount > 0) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckIcon size={20} className="text-green-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Valid</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {validTransactions.length}
          </p>
        </div>
        
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={20} className="text-yellow-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Duplicates</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {duplicates}
          </p>
        </div>
        
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <XIcon size={20} className="text-red-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Errors</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {errors.length}
          </p>
        </div>
      </div>

      {/* Transaction Preview */}
      {validTransactions.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Transaction Preview (First 10)
          </h4>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Category
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {validTransactions.slice(0, 10).map((transaction, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {transaction.date ? formatDate(transaction.date) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                      <div>
                        {transaction.description || '-'}
                        {transaction.merchant && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {transaction.merchant}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {transaction.category || 'Uncategorized'}
                    </td>
                    <td className={`px-4 py-2 text-sm text-right font-medium ${
                      getAmountColor(transaction.amount, transaction.type)
                    }`}>
                      {transaction.amount !== undefined ? formatCurrency(Math.abs(transaction.amount)) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {validTransactions.length > 10 && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
                And {validTransactions.length - 10} more transactions...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
            Import Errors
          </h4>
          <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
            {errors.slice(0, 5).map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
            {errors.length > 5 && (
              <li>• And {errors.length - 5} more errors...</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});
