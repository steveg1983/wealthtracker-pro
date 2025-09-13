import React, { useEffect, memo } from 'react';
import { AlertCircleIcon, CheckIcon } from '../icons';
import type { ColumnMapping } from '../../services/enhancedCsvImportService';
import { logger } from '../../services/loggingService';

interface PreviewStepProps {
  type: 'transaction' | 'account';
  headers: string[];
  data: string[][];
  mappings: ColumnMapping[];
  duplicateThreshold: number;
  showDuplicates: boolean;
  onDuplicateThresholdChange: (value: number) => void;
  onShowDuplicatesChange: (value: boolean) => void;
}

export const PreviewStep = memo(function PreviewStep({
  type,
  headers,
  data,
  mappings,
  duplicateThreshold,
  showDuplicates,
  onDuplicateThresholdChange,
  onShowDuplicatesChange
}: PreviewStepProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PreviewStep component initialized', {
      componentName: 'PreviewStep'
    });
  }, []);

  
  // Get mapped column indices
  const getMappedData = () => {
    const mappedIndices = mappings.map(m => ({
      sourceIndex: headers.indexOf(m.sourceColumn),
      targetField: m.targetField,
      transform: m.transform
    })).filter(m => m.sourceIndex !== -1);

    return data.slice(0, 10).map(row => {
      const mappedRow: Record<string, any> = {};
      mappedIndices.forEach(({ sourceIndex, targetField, transform }) => {
        let value: any = row[sourceIndex];
        if (transform && typeof transform === 'function') {
          value = transform(value);
        }
        mappedRow[targetField] = value;
      });
      return mappedRow;
    });
  };

  const previewData = getMappedData();
  const targetFields = mappings.map(m => m.targetField).filter(f => f);

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Preview Import
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Review how your data will be imported. Showing first 10 rows.
        </p>
      </div>

      {/* Import Settings */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Import Settings
        </h4>
        
        <div className="flex items-center justify-between">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showDuplicates}
              onChange={(e) => onShowDuplicatesChange(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Check for duplicates
            </span>
          </label>
          
          {showDuplicates && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Similarity threshold:
              </span>
              <input
                type="number"
                min="50"
                max="100"
                value={duplicateThreshold}
                onChange={(e) => onDuplicateThresholdChange(parseInt(e.target.value))}
                className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>• {data.length} rows will be processed</p>
          <p>• {mappings.length} columns mapped</p>
          {type === 'transaction' && (
            <p>• Transactions will be added to their respective accounts</p>
          )}
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                #
              </th>
              {targetFields.map(field => (
                <th key={field} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {previewData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {index + 1}
                </td>
                {targetFields.map(field => (
                  <td key={field} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                    {row[field] !== undefined ? (
                      <span className={field === 'amount' && parseFloat(row[field]) < 0 ? 'text-red-600' : ''}>
                        {field === 'amount' && !isNaN(parseFloat(row[field])) 
                          ? `$${Math.abs(parseFloat(row[field])).toFixed(2)}`
                          : row[field]}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length > 10 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          ... and {data.length - 10} more rows
        </p>
      )}

      {/* Validation Messages */}
      <div className="space-y-2">
        {type === 'transaction' && (
          <>
            {!mappings.some(m => m.targetField === 'date') && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                  <AlertCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Date field is required but not mapped
                  </span>
                </div>
              </div>
            )}
            {!mappings.some(m => m.targetField === 'amount') && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                  <AlertCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Amount field is required but not mapped
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        
        {mappings.length > 0 && mappings.every(m => m.sourceColumn && m.targetField) && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-sm text-green-700 dark:text-green-300">
                Data is ready to import
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});