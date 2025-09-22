import React, { useEffect, memo } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { EditIcon, DeleteIcon } from '../icons';
import type { Dividend } from './types';
import { useLogger } from '../services/ServiceProvider';

interface DividendHistoryProps {
  dividends: Dividend[];
  onEdit: (dividend: Dividend) => void;
  onDelete: (dividendId: string) => void;
}

export const DividendHistory = memo(function DividendHistory({ dividends,
  onEdit,
  onDelete
 }: DividendHistoryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DividendHistory component initialized', {
      componentName: 'DividendHistory'
    });
  }, []);

  const { formatCurrency, getCurrencySymbol, displayCurrency } = useCurrencyDecimal();
  const currencySymbol = getCurrencySymbol(displayCurrency);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Dividend History</h3>
      
      {dividends.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No dividend records found</p>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {dividends.map(dividend => (
              <div key={dividend.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-lg">{dividend.symbol}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {dividend.paymentDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(dividend)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-blue-900 dark:text-gray-500"
                      title="Edit"
                    >
                      <EditIcon size={20} />
                    </button>
                    <button
                      onClick={() => onDelete(dividend.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:text-red-900 dark:text-red-400"
                      title="Delete"
                    >
                      <DeleteIcon size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    dividend.type === 'special' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {dividend.type}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {dividend.frequency}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Amount</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(dividend.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Per Share</span>
                    <span className="text-gray-900 dark:text-white">
                      {currencySymbol}{dividend.amountPerShare.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary dark:bg-gray-700">
                <tr className="border-b border-[#5A729A] dark:border-gray-600">
                  <th className="text-left py-3 px-4 text-white text-sm font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-white text-sm font-medium">Symbol</th>
                  <th className="text-right py-3 px-4 text-white text-sm font-medium">Amount</th>
                  <th className="text-right py-3 px-4 text-white text-sm font-medium">Per Share</th>
                  <th className="text-center py-3 px-4 text-white text-sm font-medium">Type</th>
                  <th className="text-center py-3 px-4 text-white text-sm font-medium">Frequency</th>
                  <th className="text-right py-3 px-4 text-white text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map(dividend => (
                  <tr key={dividend.id} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4">{dividend.paymentDate.toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium">{dividend.symbol}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(dividend.amount)}</td>
                    <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">
                      {currencySymbol}{dividend.amountPerShare.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${
                        dividend.type === 'special' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        {dividend.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm">{dividend.frequency}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(dividend)}
                          className="p-1 text-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <EditIcon size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(dividend.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                          title="Delete"
                        >
                          <DeleteIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
});
