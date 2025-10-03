import { memo, useEffect } from 'react';
import { ScissorsIcon as Scissors } from '../icons';
import { formatCurrency } from '../../utils/formatters';
import type { Transaction } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface SplitHeaderProps {
  transaction: Transaction;
  totalAmount: number;
}

export const SplitHeader = memo(function SplitHeader({ transaction, 
  totalAmount 
 }: SplitHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SplitHeader component initialized', {
      componentName: 'SplitHeader'
    });
  }, []);

  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-500 to-purple-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Scissors size={24} />
          <div>
            <h2 className="text-xl font-bold">Split Transaction</h2>
            <p className="text-sm opacity-90">
              Original: {transaction.description} • {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});