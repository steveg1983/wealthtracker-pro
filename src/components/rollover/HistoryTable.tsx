import React, { useEffect, memo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { CheckCircleIcon, ClockIcon } from '../icons';
import type { RolloverHistory } from './types';
import { useLogger } from '../services/ServiceProvider';

interface HistoryTableProps {
  history: RolloverHistory[];
}

export const HistoryTable = memo(function HistoryTable({ history  }: HistoryTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HistoryTable component initialized', {
      componentName: 'HistoryTable'
    });
  }, []);

  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium mb-4">Rollover History</h3>
        <div className="text-center py-8 text-gray-500">
          No rollover history available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-medium mb-4">Rollover History</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
              <th className="pb-3 font-medium">Month</th>
              <th className="pb-3 font-medium">Amount</th>
              <th className="pb-3 font-medium">Categories</th>
              <th className="pb-3 font-medium">Applied</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map(item => (
              <tr key={item.id}>
                <td className="py-3">
                  <div className="font-medium">
                    {format(new Date(item.fromPeriod.year, item.fromPeriod.month - 1), 'MMMM yyyy')}
                  </div>
                </td>
                <td className="py-3">
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(item.totalRolledOver.toNumber())}
                  </span>
                </td>
                <td className="py-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.rollovers.length} categories
                  </div>
                </td>
                <td className="py-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(item.appliedAt), 'MMM d, yyyy')}
                  </div>
                </td>
                <td className="py-3">
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <CheckCircleIcon size={16} />
                    Applied
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});