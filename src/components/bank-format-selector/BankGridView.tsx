import React, { memo } from 'react';
import { CheckIcon } from '../icons';
import type { BankFormat } from './bankData';
import { TYPE_GROUPS } from './bankData';
import { logger } from '../../services/loggingService';

interface BankGridViewProps {
  banks: BankFormat[];
  selectedBank: string | null;
  onBankSelect: (bank: BankFormat) => void;
}

/**
 * Grid view display for bank selection
 * Optimized for desktop viewing with card-based layout
 */
export const BankGridView = memo(function BankGridView({
  banks,
  selectedBank,
  onBankSelect
}: BankGridViewProps): React.JSX.Element {
  try {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {banks.map(bank => {
          const isSelected = selectedBank === bank.key;
          return (
            <button
              key={bank.key}
              onClick={() => onBankSelect(bank)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                isSelected
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {bank.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {bank.region} • {TYPE_GROUPS[bank.type]}
                  </p>
                </div>
                {isSelected && (
                  <CheckIcon size={16} className="text-gray-500 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  } catch (error) {
    logger.error('BankGridView render error:', error);
    return (
      <div className="text-center py-4 text-red-600 dark:text-red-400">
        Error loading bank grid
      </div>
    );
  }
});