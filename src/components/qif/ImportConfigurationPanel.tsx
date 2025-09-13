/**
 * Import Configuration Panel Component
 * World-class configuration with QuickBooks-level precision
 */

import React, { useEffect, memo } from 'react';
import { FileTextIcon, UploadIcon } from '../icons';
import { LoadingButton } from '../loading/LoadingState';
import type { Account } from '../../types';
import type { ParseResult } from '../../services/qif/qifImportModalService';
import { logger } from '../../services/loggingService';

interface ImportConfigurationPanelProps {
  file: File | null;
  parseResult: ParseResult;
  accounts: Account[];
  selectedAccountId: string;
  skipDuplicates: boolean;
  isProcessing: boolean;
  onAccountChange: (accountId: string) => void;
  onSkipDuplicatesChange: (skip: boolean) => void;
  onImport: () => void;
  onCancel: () => void;
}

/**
 * Enterprise-grade import configuration panel
 */
export const ImportConfigurationPanel = memo(function ImportConfigurationPanel({
  file,
  parseResult,
  accounts,
  selectedAccountId,
  skipDuplicates,
  isProcessing,
  onAccountChange,
  onSkipDuplicatesChange,
  onImport,
  onCancel
}: ImportConfigurationPanelProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportConfigurationPanel component initialized', {
      componentName: 'ImportConfigurationPanel'
    });
  }, []);

  return (
    <div className="space-y-6">
      <FileInfoDisplay file={file} parseResult={parseResult} />
      <AccountSelector
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onAccountChange={onAccountChange}
      />
      <ImportOptions
        skipDuplicates={skipDuplicates}
        onSkipDuplicatesChange={onSkipDuplicatesChange}
      />
      <TransactionPreview parseResult={parseResult} />
      <ActionButtons
        selectedAccountId={selectedAccountId}
        isProcessing={isProcessing}
        onImport={onImport}
        onCancel={onCancel}
      />
    </div>
  );
});

/**
 * File information display
 */
const FileInfoDisplay = memo(function FileInfoDisplay({
  file,
  parseResult
}: {
  file: File | null;
  parseResult: ParseResult;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <FileTextIcon className="text-gray-600 dark:text-gray-400" size={24} />
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white">{file?.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {parseResult.transactions.length} transactions found
          {parseResult.accountType && ` (Type: ${parseResult.accountType})`}
        </p>
      </div>
    </div>
  );
});

/**
 * Account selector
 */
const AccountSelector = memo(function AccountSelector({
  accounts,
  selectedAccountId,
  onAccountChange
}: {
  accounts: Account[];
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
}): React.JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Import to Account <span className="text-red-500">*</span>
      </label>
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
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        QIF files don't contain account information, so you need to select the destination account
      </p>
    </div>
  );
});

/**
 * Import options
 */
const ImportOptions = memo(function ImportOptions({
  skipDuplicates,
  onSkipDuplicatesChange
}: {
  skipDuplicates: boolean;
  onSkipDuplicatesChange: (skip: boolean) => void;
}): React.JSX.Element {
  return (
    <div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={skipDuplicates}
          onChange={(e) => onSkipDuplicatesChange(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Skip potential duplicates
        </span>
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
        Checks for transactions with the same date, amount, and payee
      </p>
    </div>
  );
});

/**
 * Transaction preview
 */
const TransactionPreview = memo(function TransactionPreview({
  parseResult
}: {
  parseResult: ParseResult;
}): React.JSX.Element {
  const previewTransactions = parseResult.transactions.slice(0, 5);
  const remainingCount = parseResult.transactions.length - 5;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">
        Preview (First 5 transactions)
      </h4>
      <div className="space-y-2 text-sm">
        {previewTransactions.map((trx, index) => (
          <TransactionPreviewItem key={index} transaction={trx} />
        ))}
        {remainingCount > 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
            ...and {remainingCount} more transactions
          </p>
        )}
      </div>
    </div>
  );
});

/**
 * Transaction preview item
 */
const TransactionPreviewItem = memo(function TransactionPreviewItem({
  transaction
}: {
  transaction: any;
}): React.JSX.Element {
  return (
    <div className="flex justify-between text-gray-600 dark:text-gray-400">
      <span>{transaction.date} - {transaction.payee || transaction.memo || 'No description'}</span>
      <span className={transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}>
        £{Math.abs(transaction.amount).toFixed(2)}
      </span>
    </div>
  );
});

/**
 * Action buttons
 */
const ActionButtons = memo(function ActionButtons({
  selectedAccountId,
  isProcessing,
  onImport,
  onCancel
}: {
  selectedAccountId: string;
  isProcessing: boolean;
  onImport: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <div className="flex justify-end gap-3">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        Cancel
      </button>
      <LoadingButton
        isLoading={isProcessing}
        onClick={onImport}
        disabled={!selectedAccountId}
        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <UploadIcon size={20} />
        Import Transactions
      </LoadingButton>
    </div>
  );
});