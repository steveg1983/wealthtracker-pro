import React, { useEffect, memo, useCallback, useState } from 'react';
import { UploadIcon, FileTextIcon, AlertCircleIcon } from '../icons';
import { enhancedCsvImportService } from '../../services/enhancedCsvImportService';
import { useLogger } from '../services/ServiceProvider';

interface UploadStepProps {
  type: 'transaction' | 'account';
  onFileProcessed: (content: string, headers: string[], data: string[][]) => void;
}

export const UploadStep = memo(function UploadStep({ type, onFileProcessed  }: UploadStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('UploadStep component initialized', {
      componentName: 'UploadStep'
    });
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');

  const processFile = useCallback((file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      try {
        const parsed = enhancedCsvImportService.parser.parseCSV(content);
        if (parsed.headers.length === 0) {
          setError('CSV file appears to be empty');
          return;
        }
        if (parsed.data.length === 0) {
          setError('CSV file contains no data rows');
          return;
        }
        
        onFileProcessed(content, parsed.headers, parsed.data);
      } catch (err) {
        setError('Failed to parse CSV file. Please check the file format.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [onFileProcessed]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError('');
      processFile(file);
    }
  }, [processFile]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      setError('');
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Upload {type === 'transaction' ? 'Transactions' : 'Accounts'} CSV
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload a CSV file containing your {type === 'transaction' ? 'transaction' : 'account'} data
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8
          ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          transition-colors cursor-pointer
        `}
      >
        <input
          type="file"
          id="csv-upload"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="flex flex-col items-center">
            {isDragging ? (
              <>
                <FileTextIcon className="w-16 h-16 text-blue-500 mb-4" />
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  Drop your file here
                </p>
              </>
            ) : (
              <>
                <UploadIcon className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                  Drag & drop your CSV file here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  or <span className="text-blue-600 dark:text-blue-400 hover:underline">browse</span> to upload
                </p>
              </>
            )}
          </div>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <AlertCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Expected Format
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Your CSV should contain headers in the first row. Common columns include:
        </p>
        {type === 'transaction' ? (
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <li>• Date (transaction date)</li>
            <li>• Description (transaction description)</li>
            <li>• Amount (positive for income, negative for expenses)</li>
            <li>• Category (optional)</li>
            <li>• Account (optional)</li>
          </ul>
        ) : (
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <li>• Account Name</li>
            <li>• Account Type (checking, savings, etc.)</li>
            <li>• Balance</li>
            <li>• Currency (optional)</li>
          </ul>
        )}
      </div>
    </div>
  );
});
