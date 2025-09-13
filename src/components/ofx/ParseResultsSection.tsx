/**
 * Parse Results Section Component
 * Displays parsed OFX data and import options
 */

import React, { useEffect, memo } from 'react';
import { FileTextIcon, LinkIcon, UnlinkIcon, UploadIcon } from '../icons';
import { LoadingButton } from '../loading/LoadingState';
import type { ParseResult } from '../../services/ofxImportModalService';
import type { Account } from '../../types';
import { logger } from '../../services/loggingService';

interface ParseResultsSectionProps {
  file: File | null;
  parseResult: ParseResult;
  selectedAccountId: string;
  skipDuplicates: boolean;
  isProcessing: boolean;
  accounts: Account[];
  onAccountChange: (accountId: string) => void;
  onSkipDuplicatesChange: (skip: boolean) => void;
  onCancel: () => void;
  onImport: () => void;
}

export const ParseResultsSection = memo(function ParseResultsSection({
  file,
  parseResult,
  selectedAccountId,
  skipDuplicates,
  isProcessing,
  accounts,
  onAccountChange,
  onSkipDuplicatesChange,
  onCancel,
  onImport
}: ParseResultsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ParseResultsSection component initialized', {
      componentName: 'ParseResultsSection'
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* File Info */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <FileTextIcon className="text-gray-600 dark:text-gray-400" size={24} />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white">{file?.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {parseResult.transactions.length} transactions found
          </p>
        </div>
      </div>
      
      {/* Account Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Import to Account
        </label>
        
        {parseResult.matchedAccount ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <LinkIcon className="text-green-600 dark:text-green-400 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-green-900 dark:text-green-300">
                  Automatically matched to: {parseResult.matchedAccount.name}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  Based on account number ending in {parseResult.unmatchedAccount?.accountId.slice(-4)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {parseResult.unmatchedAccount && (
              <div className="p-4 mb-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <UnlinkIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-300">
                      No matching account found
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      OFX Account: ****{parseResult.unmatchedAccount.accountId.slice(-4)}
                      {parseResult.unmatchedAccount.bankId && ` (Sort code: ${parseResult.unmatchedAccount.bankId.slice(-6)})`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <select
              value={selectedAccountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">Select an account...</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      
      {/* Import Options */}
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => onSkipDuplicatesChange(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Skip duplicate transactions
          </span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
          Uses unique transaction IDs to prevent importing the same transaction twice
        </p>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {parseResult.transactions.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {parseResult.duplicates || 0}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates Found</p>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          Cancel
        </button>
        <LoadingButton
          isLoading={isProcessing}
          onClick={onImport}
          disabled={!selectedAccountId && !parseResult.matchedAccount}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50"
        >
          <UploadIcon size={20} />
          Import Transactions
        </LoadingButton>
      </div>
    </div>
  );
});