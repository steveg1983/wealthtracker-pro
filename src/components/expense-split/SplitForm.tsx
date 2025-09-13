import React, { useEffect, memo } from 'react';
import type { SplitMethod } from '../../services/expenseSplitService';
import { logger } from '../../services/loggingService';

interface SplitFormProps {
  description: string;
  totalAmount: number;
  splitMethod: SplitMethod;
  onDescriptionChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onSplitMethodChange: (value: SplitMethod) => void;
}

const SplitForm = memo(function SplitForm({
  description,
  totalAmount,
  splitMethod,
  onDescriptionChange,
  onAmountChange,
  onSplitMethodChange
}: SplitFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SplitForm component initialized', {
      componentName: 'SplitForm'
    });
  }, []);

  return (
    <div className="space-y-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g., Dinner at restaurant"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Total Amount
        </label>
        <input
          type="number"
          step="0.01"
          value={totalAmount}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Split Method
        </label>
        <select
          value={splitMethod}
          onChange={(e) => onSplitMethodChange(e.target.value as SplitMethod)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="equal">Equal Split</option>
          <option value="custom">Custom Amounts</option>
          <option value="percentage">Percentage Split</option>
        </select>
      </div>
    </div>
  );
});

export default SplitForm;