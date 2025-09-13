import React, { useEffect, memo } from 'react';
import { ArrowRightLeftIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface TransactionTypeSelectorProps {
  type: 'income' | 'expense' | 'transfer';
  onChange: (type: 'income' | 'expense' | 'transfer') => void;
}

export const TransactionTypeSelector = memo(function TransactionTypeSelector({
  type,
  onChange
}: TransactionTypeSelectorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TransactionTypeSelector component initialized', {
      componentName: 'TransactionTypeSelector'
    });
  }, []);

  return (
    <div className="md:col-span-12">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <ArrowRightLeftIcon size={16} />
        Type
      </label>
      <div className="flex gap-4 items-center h-[42px]">
        <label className="flex items-center">
          <input
            type="radio"
            value="income"
            checked={type === 'income'}
            onChange={(e) => onChange(e.target.value as 'income')}
            className="mr-2"
          />
          <span className="text-green-600 dark:text-green-400">Income</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="expense"
            checked={type === 'expense'}
            onChange={(e) => onChange(e.target.value as 'expense')}
            className="mr-2"
          />
          <span className="text-red-600 dark:text-red-400">Expense</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="transfer"
            checked={type === 'transfer'}
            onChange={(e) => onChange(e.target.value as 'transfer')}
            className="mr-2"
          />
          <span className="text-gray-700 dark:text-gray-300">Transfer</span>
        </label>
      </div>
    </div>
  );
});