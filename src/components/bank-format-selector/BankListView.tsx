import React, { memo } from 'react';
import { CheckIcon } from '../icons';
import type { BankFormat } from './bankData';
import { TYPE_GROUPS } from './bankData';
import { logger } from '../../services/loggingService';

interface BankListViewProps {
  banks: BankFormat[];
  selectedBank: string | null;
  onBankSelect: (bank: BankFormat) => void;
}

/**
 * List view display for bank selection
 * Optimized for mobile viewing with full-width layout
 */
export const BankListView = memo(function BankListView({
  banks,
  selectedBank,
  onBankSelect
}: BankListViewProps): React.JSX.Element {
  try {
    return (
      <div className="space-y-2">
        {banks.map(bank => {
          const isSelected = selectedBank === bank.key;
          return (
            <button
              key={bank.key}
              onClick={() => onBankSelect(bank)}
              className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                isSelected
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {bank.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {bank.region} • {TYPE_GROUPS[bank.type]}
                </p>
              </div>
              {isSelected && (
                <CheckIcon size={20} className="text-gray-500" />
              )}
            </button>
          );
        })}
      </div>
    );
  } catch (error) {
    logger.error('BankListView render error:', error);
    return (
      <div className="text-center py-4 text-red-600 dark:text-red-400">
        Error loading bank list
      </div>
    );
  }
});