/**
 * Parse Results Component
 * Displays OFX parsing results and statistics
 */

import React, { useEffect } from 'react';
import { InfoIcon, AlertCircleIcon, CheckIcon } from '../icons';
import { format } from 'date-fns';
import { ofxImportModalService } from '../../services/ofxImportModalService';
import type { ParseResult } from '../../services/ofxImportModalService';
import { useLogger } from '../services/ServiceProvider';

interface ParseResultsProps {
  parseResult: ParseResult | null;
  duplicateCount: number;
  dateRange: { start: Date | null; end: Date | null };
}

const ParseResults = React.memo(({
  parseResult,
  duplicateCount,
  dateRange
}: ParseResultsProps) => {
  if (!parseResult) return null;

  const accountInfo = ofxImportModalService.formatAccountInfo(parseResult.unmatchedAccount);

  return (
    <div className="space-y-4">
      {/* Account Info */}
      {accountInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Account Information
              </h4>
              <div className="mt-1 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                {accountInfo.bankId && (
                  <div>Bank ID: {accountInfo.bankId}</div>
                )}
                {accountInfo.accountId && (
                  <div>Account: {accountInfo.accountId}</div>
                )}
                {accountInfo.accountType && (
                  <div>Type: {accountInfo.accountType}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {parseResult.transactions.length}
          </p>
        </div>
        
        {duplicateCount > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">Duplicates</p>
            <p className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
              {duplicateCount}
            </p>
          </div>
        )}
        
        {dateRange.start && dateRange.end && (
          <>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">From</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {format(dateRange.start, 'MMM d, yyyy')}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">To</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {format(dateRange.end, 'MMM d, yyyy')}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Status Message */}
      {parseResult.matchedAccount ? (
        <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
          <CheckIcon className="h-4 w-4" />
          <span>Account matched: {parseResult.matchedAccount.name}</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertCircleIcon className="h-4 w-4" />
          <span>Please select an account for import</span>
        </div>
      )}
    </div>
  );
});

ParseResults.displayName = 'ParseResults';

export default ParseResults;