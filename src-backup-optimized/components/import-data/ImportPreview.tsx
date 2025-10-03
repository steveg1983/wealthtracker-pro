import { memo, useEffect } from 'react';
import type { ParsedData } from '../../services/importParsingService';
import { useLogger } from '../services/ServiceProvider';

interface ImportPreviewProps {
  preview: ParsedData;
}

/**
 * Import preview component
 * Shows summary of data to be imported
 */
export const ImportPreview = memo(function ImportPreview({ preview
 }: ImportPreviewProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportPreview component initialized', {
      componentName: 'ImportPreview',
      accountCount: preview.accounts.length,
      transactionCount: preview.transactions.length,
      hasData: preview.accounts.length > 0 || preview.transactions.length > 0
    });
  }, []);
  if (preview.accounts.length === 0 && preview.transactions.length === 0) {
    logger.info('ImportPreview rendering skipped - no data', {
      reason: 'no_accounts_or_transactions'
    });
    return null;
  }

  logger.debug('ImportPreview rendering with data', {
    accountCount: preview.accounts.length,
    transactionCount: preview.transactions.length,
    accountTypes: preview.accounts.map(acc => acc.type),
    dateRange: preview.transactions.length > 0 ? {
      start: preview.transactions[0].date.toISOString(),
      end: preview.transactions[preview.transactions.length - 1].date.toISOString()
    } : null
  });

  return (
    <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h3 className="font-semibold mb-2 dark:text-white">Preview</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Accounts found:</p>
          <p className="font-semibold dark:text-white">{preview.accounts.length}</p>
          {preview.accounts.slice(0, 5).map((acc, i) => (
            <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
              • {acc.name} ({acc.type})
            </p>
          ))}
          {preview.accounts.length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              • ... and {preview.accounts.length - 5} more
            </p>
          )}
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Transactions found:</p>
          <p className="font-semibold dark:text-white">{preview.transactions.length}</p>
          {preview.transactions.length > 0 && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Date range: {preview.transactions[0].date.toLocaleDateString()} - 
                {preview.transactions[preview.transactions.length - 1].date.toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                First: {preview.transactions[0].description.substring(0, 30)}...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
});