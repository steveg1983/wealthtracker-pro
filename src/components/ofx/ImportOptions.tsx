/**
 * Import Options Component
 * Configuration options for OFX import
 */

import React, { useEffect } from 'react';
import { LinkIcon, UnlinkIcon } from '../icons';
import type { Account } from '../../types';
import { logger } from '../../services/loggingService';

interface ImportOptionsProps {
  accounts: Account[];
  selectedAccountId: string;
  skipDuplicates: boolean;
  duplicateCount: number;
  onAccountChange: (accountId: string) => void;
  onSkipDuplicatesChange: (skip: boolean) => void;
  canImport: boolean;
}

const ImportOptions = React.memo(({
  accounts,
  selectedAccountId,
  skipDuplicates,
  duplicateCount,
  onAccountChange,
  onSkipDuplicatesChange,
  canImport
}: ImportOptionsProps) => {
  return (
    <div className="space-y-4">
      {/* Account Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Import to Account
        </label>
        <select
          value={selectedAccountId}
          onChange={(e) => onAccountChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={!canImport}
        >
          <option value="">Select an account...</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.institution})
            </option>
          ))}
        </select>
      </div>

      {/* Duplicate Handling */}
      {duplicateCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {skipDuplicates ? (
                  <UnlinkIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                ) : (
                  <LinkIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                )}
                <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                  Duplicate Transactions Detected
                </h4>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                Found {duplicateCount} potential duplicate{duplicateCount !== 1 ? 's' : ''} 
                based on date and amount matching.
              </p>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => onSkipDuplicatesChange(e.target.checked)}
                  className="h-4 w-4 text-[var(--color-primary)] rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Skip duplicate transactions
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Additional Options */}
      <div className="space-y-2">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={true}
            disabled
            className="h-4 w-4 text-[var(--color-primary)] rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Auto-categorize transactions
          </span>
        </label>
      </div>
    </div>
  );
});

ImportOptions.displayName = 'ImportOptions';

export default ImportOptions;