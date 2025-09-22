import React, { useEffect, memo } from 'react';
import { CheckIcon } from '../icons';
import type { ImportSummary } from './types';
import { useLogger } from '../services/ServiceProvider';

interface ImportSummaryViewProps {
  summary: ImportSummary;
  onReset: () => void;
  onClose: () => void;
}

export const ImportSummaryView = memo(function ImportSummaryView({ summary, 
  onReset, 
  onClose 
 }: ImportSummaryViewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportSummaryView component initialized', {
      componentName: 'ImportSummaryView'
    });
  }, []);

  return (
    <div className="text-center">
      <CheckIcon size={48} className="mx-auto text-green-600 mb-4" />
      <h3 className="text-lg font-semibold mb-4">Import Complete!</h3>
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Files Processed</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.successfulFiles}/{summary.totalFiles}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Transactions Imported</p>
            <p className="text-2xl font-bold text-green-600">
              {summary.totalTransactions}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Duplicates Skipped</p>
            <p className="text-2xl font-bold text-yellow-600">
              {summary.totalDuplicates}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Success Rate</p>
            <p className="text-2xl font-bold text-primary">
              {Math.round((summary.successfulFiles / summary.totalFiles) * 100)}%
            </p>
          </div>
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReset}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          Import More Files
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Done
        </button>
      </div>
    </div>
  );
});