import React, { useEffect, memo } from 'react';
import { CheckIcon, AlertCircleIcon, XIcon, DownloadIcon } from '../icons';
import type { ImportResult } from '../../services/enhancedCsvImportService';
import { logger } from '../../services/loggingService';

interface ResultStepProps {
  result: ImportResult;
  type: 'transaction' | 'account';
  onExportReport: () => void;
}

export const ResultStep = memo(function ResultStep({ 
  result, 
  type,
  onExportReport 
}: ResultStepProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ResultStep component initialized', {
      componentName: 'ResultStep'
    });
  }, []);

  const total = (result.success + result.failed);
  const successRate = total > 0 
    ? ((result.success / total) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        {result.success === total ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <CheckIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Import Successful!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All {type}s were imported successfully
            </p>
          </>
        ) : result.success > 0 ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mb-4">
              <AlertCircleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Partial Import
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Some {type}s could not be imported
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <XIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Import Failed
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No {type}s were imported
            </p>
          </>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {total}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total Rows
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {result.success}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Imported
          </p>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {result.duplicates}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Duplicates
          </p>
        </div>
        
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {result.failed}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Failed
          </p>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Success Rate
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {successRate}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              result.success === total 
                ? 'bg-green-600' 
                : result.success > total / 2 
                ? 'bg-yellow-600' 
                : 'bg-red-600'
            }`}
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      {/* Error Details */}
      {result.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
            Import Errors
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {result.errors.slice(0, 10).map((error, index) => (
              <div key={index} className="text-xs text-red-600 dark:text-red-400">
                <span className="font-medium">Row {error.row}:</span> {error.error}
              </div>
            ))}
            {result.errors.length > 10 && (
              <p className="text-xs text-red-500 dark:text-red-400 italic">
                ... and {result.errors.length - 10} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Imported Items Preview */}
      {result.success > 0 && result.items && result.items.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
            Successfully Imported
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {result.items.slice(0, 5).map((item: any, index: number) => (
              <div key={index} className="text-xs text-green-600 dark:text-green-400">
                {type === 'transaction' ? (
                  <span>
                    {item.date} - {item.description} - ${Math.abs(Number(item.amount ?? 0)).toFixed(2)}
                  </span>
                ) : (
                  <span>{item.name} ({item.type})</span>
                )}
              </div>
            ))}
            {result.items.length > 5 && (
              <p className="text-xs text-green-500 dark:text-green-400 italic">
                ... and {result.items.length - 5} more items
              </p>
            )}
          </div>
        </div>
      )}

      {/* Export Report Button */}
      <div className="flex justify-center">
        <button
          onClick={onExportReport}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
        >
          <DownloadIcon className="w-4 h-4 mr-2" />
          Export Import Report
        </button>
      </div>
    </div>
  );
});
