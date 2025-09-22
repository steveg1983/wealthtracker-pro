import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, XIcon, AlertCircleIcon } from '../icons';
import type { FileInfo } from './FileUploadStep';
import { useLogger } from '../services/ServiceProvider';

interface ImportResultStepProps {
  files: FileInfo[];
  totalImported: number;
  totalDuplicates: number;
  onClose: () => void;
}

export const ImportResultStep = memo(function ImportResultStep({ files,
  totalImported,
  totalDuplicates,
  onClose
 }: ImportResultStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportResultStep component initialized', {
      componentName: 'ImportResultStep'
    });
  }, []);

  const successfulFiles = files.filter(f => f.status === 'success').length;
  const failedFiles = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircleIcon size={32} className="text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Import Complete!
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Successfully imported {totalImported} transactions from {successfulFiles} file{successfulFiles !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {totalImported}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Imported
          </p>
        </div>
        
        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {totalDuplicates}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Skipped (Duplicates)
          </p>
        </div>
        
        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {failedFiles}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Failed Files
          </p>
        </div>
      </div>

      {/* File Details */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          File Import Details
        </h4>
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {file.status === 'success' ? (
                  <CheckCircleIcon size={20} className="text-green-600" />
                ) : file.status === 'error' ? (
                  <XIcon size={20} className="text-red-600" />
                ) : (
                  <AlertCircleIcon size={20} className="text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {file.status === 'success' && (
                      <>
                        {file.imported} imported
                        {file.duplicates && file.duplicates > 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {' '}• {file.duplicates} duplicates skipped
                          </span>
                        )}
                      </>
                    )}
                    {file.status === 'error' && (
                      <span className="text-red-600 dark:text-red-400">
                        {file.error || 'Import failed'}
                      </span>
                    )}
                    {file.status === 'pending' && 'Not processed'}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-medium ${
                file.status === 'success' ? 'text-green-600' :
                file.status === 'error' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {file.status === 'success' ? 'Success' :
                 file.status === 'error' ? 'Failed' :
                 'Skipped'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
});