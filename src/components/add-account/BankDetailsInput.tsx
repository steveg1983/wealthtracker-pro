import React, { useEffect, memo } from 'react';
import type { ValidationErrors } from './types';
import { logger } from '../../services/loggingService';

interface BankDetailsInputProps {
  sortCode: string;
  accountNumber: string;
  onSortCodeChange: (value: string) => void;
  onAccountNumberChange: (value: string) => void;
  validationError?: string;
  isDisabled: boolean;
}

export const BankDetailsInput = memo(function BankDetailsInput({
  sortCode,
  accountNumber,
  onSortCodeChange,
  onAccountNumberChange,
  validationError,
  isDisabled
}: BankDetailsInputProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BankDetailsInput component initialized', {
      componentName: 'BankDetailsInput'
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Sort Code
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
          </label>
          <input
            type="text"
            value={sortCode}
            onChange={(e) => onSortCodeChange(e.target.value)}
            className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 ${validationError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
            placeholder="XX-XX-XX"
            maxLength={8}
            disabled={isDisabled}
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Account Number
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => onAccountNumberChange(e.target.value)}
            className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 ${validationError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
            placeholder="12345678"
            maxLength={8}
            disabled={isDisabled}
          />
        </div>
      </div>
      
      {validationError && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {validationError}
        </div>
      )}
      
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
        <strong>Pro Tip:</strong> Adding bank details enables automatic transaction import matching, ensuring your statements are imported to the correct account.
      </div>
    </div>
  );
});