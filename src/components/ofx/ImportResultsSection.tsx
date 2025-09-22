/**
 * Import Results Section Component
 * Displays import success or failure status
 */

import React, { useEffect, memo } from 'react';
import { CheckIcon, AlertCircleIcon, RefreshCwIcon } from '../icons';
import type { ImportResult } from '../../services/ofxImportModalService';
import { useLogger } from '../services/ServiceProvider';

interface ImportResultsSectionProps {
  importResult: ImportResult;
  onReset: () => void;
  onClose: () => void;
}

export const ImportResultsSection = memo(function ImportResultsSection({ importResult,
  onReset,
  onClose
 }: ImportResultsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportResultsSection component initialized', {
      componentName: 'ImportResultsSection'
    });
  }, []);

  return (
    <div className="text-center">
      {importResult.success ? (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <CheckIcon size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Import Successful!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Imported {importResult.imported} transactions to {importResult.account?.name}
          </p>
          
          {importResult.duplicates && importResult.duplicates > 0 && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
              Skipped {importResult.duplicates} duplicate transactions
            </p>
          )}
        </>
      ) : (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
            <AlertCircleIcon size={32} className="text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Import Failed
          </h3>
          <p className="text-red-600 dark:text-red-400 mb-6">
            {importResult.error}
          </p>
        </>
      )}
      
      <div className="flex justify-center gap-3">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          <RefreshCwIcon size={20} />
          Import Another File
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
        >
          Done
        </button>
      </div>
    </div>
  );
});