/**
 * Include Options Selector Component
 * Allows selection of data to include in export
 */

import React, { useEffect } from 'react';
import type { ExportFormat, IncludeOptions } from '../../services/exportModalService';
import { exportModalService } from '../../services/exportModalService';
import { logger } from '../../services/loggingService';

interface IncludeOptionsSelectorProps {
  includeOptions: IncludeOptions;
  selectedFormat: ExportFormat;
  onOptionsChange: (options: IncludeOptions) => void;
}

const IncludeOptionsSelector = React.memo(({
  includeOptions,
  selectedFormat,
  onOptionsChange
}: IncludeOptionsSelectorProps) => {
  const options = [
    { key: 'transactions', label: 'Transactions' },
    { key: 'accounts', label: 'Account Balances' },
    { key: 'budgets', label: 'Budget Information' },
    { key: 'goals', label: 'Financial Goals' },
    { key: 'charts', label: 'Charts & Graphs (PDF/Excel only)' }
  ];

  const handleChange = (key: keyof IncludeOptions, checked: boolean) => {
    onOptionsChange({
      ...includeOptions,
      [key]: checked
    });
  };

  const isChartsDisabled = !exportModalService.isChartsSupported(selectedFormat);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Include in Export
      </label>
      <div className="space-y-2">
        {options.map(({ key, label }) => {
          const isDisabled = key === 'charts' && isChartsDisabled;
          const isChecked = includeOptions[key as keyof IncludeOptions];
          
          return (
            <label key={key} className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleChange(key as keyof IncludeOptions, e.target.checked)}
                  disabled={isDisabled}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 ${
                  isChecked
                    ? 'border-gray-600 dark:border-gray-400'
                    : 'border-gray-300 dark:border-gray-600'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isChecked && (
                    <div className="w-3 h-3 rounded-full bg-gray-600 dark:bg-gray-400 m-0.5" />
                  )}
                </div>
              </div>
              <span className={`ml-3 text-sm ${
                isDisabled
                  ? 'text-gray-400 dark:text-gray-600'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
});

IncludeOptionsSelector.displayName = 'IncludeOptionsSelector';

export default IncludeOptionsSelector;