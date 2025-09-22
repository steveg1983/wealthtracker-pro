/**
 * BatchImportModal Component - Modal for bulk importing financial data
 *
 * Features:
 * - CSV/Excel file upload
 * - Column mapping interface
 * - Data validation and preview
 * - Import progress tracking
 * - Error handling and reporting
 */

import React, { useState, useRef, useCallback } from 'react';

interface ImportMapping {
  sourceColumn: string;
  targetField: 'date' | 'amount' | 'description' | 'category' | 'account' | 'merchant' | 'type';
  required: boolean;
}

interface ImportRow {
  [key: string]: string | number;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportRow[], mapping: ImportMapping[]) => Promise<void>;
  supportedFormats?: string[];
  className?: string;
}

const defaultSupportedFormats = ['.csv', '.xlsx', '.xls'];

const targetFields = [
  { value: 'date', label: 'Date', required: true },
  { value: 'amount', label: 'Amount', required: true },
  { value: 'description', label: 'Description', required: true },
  { value: 'category', label: 'Category', required: false },
  { value: 'account', label: 'Account', required: false },
  { value: 'merchant', label: 'Merchant/Payee', required: false },
  { value: 'type', label: 'Type (income/expense)', required: false }
];

export default function BatchImportModal({
  isOpen,
  onClose,
  onImport,
  supportedFormats = defaultSupportedFormats,
  className = ''
}: BatchImportModalProps): React.JSX.Element {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<ImportMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setFile(null);
      setRawData([]);
      setHeaders([]);
      setPreviewData([]);
      setMapping([]);
      setValidationErrors([]);
      setImportProgress(0);
      setImportedCount(0);
      setErrorCount(0);
    }
  }, [isOpen]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);

    // In a real implementation, this would parse the file
    // For now, simulate parsing with mock data
    setTimeout(() => {
      const mockHeaders = ['Date', 'Description', 'Amount', 'Category', 'Account'];
      const mockData = [
        ['2024-01-15', 'Grocery Store', '-85.50', 'Groceries', 'Checking'],
        ['2024-01-16', 'Salary Deposit', '3250.00', 'Salary', 'Checking'],
        ['2024-01-17', 'Gas Station', '-45.20', 'Transport', 'Credit Card'],
        ['2024-01-18', 'Restaurant', '-32.80', 'Dining', 'Credit Card'],
        ['2024-01-19', 'Online Shopping', '-127.99', 'Shopping', 'Credit Card']
      ];

      setHeaders(mockHeaders);
      setRawData(mockData);

      // Create preview data
      const preview = mockData.slice(0, 5).map((row, index) => {
        const obj: ImportRow = {};
        mockHeaders.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });
      setPreviewData(preview);

      // Initialize mapping
      const initialMapping: ImportMapping[] = mockHeaders.map(header => ({
        sourceColumn: header,
        targetField: 'description', // Default value
        required: false
      }));

      // Auto-map obvious columns
      initialMapping.forEach(map => {
        const lowerHeader = map.sourceColumn.toLowerCase();
        if (lowerHeader.includes('date')) map.targetField = 'date';
        else if (lowerHeader.includes('amount') || lowerHeader.includes('value')) map.targetField = 'amount';
        else if (lowerHeader.includes('description') || lowerHeader.includes('memo')) map.targetField = 'description';
        else if (lowerHeader.includes('category')) map.targetField = 'category';
        else if (lowerHeader.includes('account')) map.targetField = 'account';
        else if (lowerHeader.includes('merchant') || lowerHeader.includes('payee')) map.targetField = 'merchant';
      });

      setMapping(initialMapping);
      setStep('mapping');
    }, 1000);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && supportedFormats.some(format => droppedFile.name.toLowerCase().endsWith(format))) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect, supportedFormats]);

  const handleMappingChange = (index: number, targetField: ImportMapping['targetField']) => {
    setMapping(prev => prev.map((map, i) =>
      i === index ? { ...map, targetField } : map
    ));
  };

  const validateData = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Check required mappings
    const requiredFields = targetFields.filter(field => field.required);
    requiredFields.forEach(field => {
      const mapped = mapping.find(map => map.targetField === field.value);
      if (!mapped) {
        errors.push({
          row: -1,
          column: field.value,
          message: `Required field "${field.label}" is not mapped`
        });
      }
    });

    // Validate data rows
    rawData.forEach((row, rowIndex) => {
      mapping.forEach(map => {
        const columnIndex = headers.indexOf(map.sourceColumn);
        const value = row[columnIndex];

        // Validate required fields
        if (targetFields.find(f => f.value === map.targetField)?.required && !value) {
          errors.push({
            row: rowIndex + 1,
            column: map.sourceColumn,
            message: `Required field "${map.targetField}" is empty`
          });
        }

        // Validate specific field types
        if (map.targetField === 'date' && value) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({
              row: rowIndex + 1,
              column: map.sourceColumn,
              message: 'Invalid date format'
            });
          }
        }

        if (map.targetField === 'amount' && value) {
          const amount = parseFloat(String(value).replace(/[^-\d.]/g, ''));
          if (isNaN(amount)) {
            errors.push({
              row: rowIndex + 1,
              column: map.sourceColumn,
              message: 'Invalid amount format'
            });
          }
        }
      });
    });

    return errors;
  };

  const handlePreview = () => {
    const errors = validateData();
    setValidationErrors(errors);
    setStep('preview');
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) return;

    setStep('importing');
    setImportProgress(0);
    setImportedCount(0);
    setErrorCount(0);

    try {
      // Convert raw data to structured format
      const structuredData = rawData.map(row => {
        const obj: ImportRow = {};
        mapping.forEach(map => {
          const columnIndex = headers.indexOf(map.sourceColumn);
          obj[map.targetField] = row[columnIndex];
        });
        return obj;
      });

      // Simulate import progress
      const totalRows = structuredData.length;
      for (let i = 0; i < totalRows; i++) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
        setImportProgress(((i + 1) / totalRows) * 100);
        setImportedCount(i + 1);
      }

      await onImport(structuredData, mapping);
      setStep('complete');
    } catch (error) {
      setErrorCount(rawData.length);
    }
  };

  if (!isOpen) return <></>;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className={`inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl ${className}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Batch Import Data
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {[
              { key: 'upload', label: 'Upload' },
              { key: 'mapping', label: 'Map Columns' },
              { key: 'preview', label: 'Preview' },
              { key: 'importing', label: 'Import' }
            ].map((stepItem, index) => (
              <div key={stepItem.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepItem.key ? 'bg-blue-600 text-white' :
                  ['mapping', 'preview', 'importing', 'complete'].indexOf(step) > ['upload', 'mapping', 'preview', 'importing'].indexOf(stepItem.key)
                    ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {['mapping', 'preview', 'importing', 'complete'].indexOf(step) > ['upload', 'mapping', 'preview', 'importing'].indexOf(stepItem.key) ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  step === stepItem.key ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepItem.label}
                </span>
                {index < 3 && (
                  <div className={`w-12 h-0.5 mx-4 ${
                    ['mapping', 'preview', 'importing', 'complete'].indexOf(step) > index ? 'bg-green-600' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={supportedFormats.join(',')}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <div className="text-gray-400 text-6xl mb-4">📄</div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Upload your data file
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Drag and drop your file here, or click to browse
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Choose File
                </button>
                <p className="text-xs text-gray-400 mt-4">
                  Supported formats: {supportedFormats.join(', ')}
                </p>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Map your columns
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Match your file columns to the appropriate fields
                </p>
              </div>

              <div className="space-y-4">
                {mapping.map((map, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {map.sourceColumn}
                      </label>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Sample: {previewData[0]?.[map.sourceColumn]}
                      </div>
                    </div>
                    <div className="w-4 text-gray-400">→</div>
                    <div className="flex-1">
                      <select
                        value={map.targetField}
                        onChange={(e) => handleMappingChange(index, e.target.value as ImportMapping['targetField'])}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {targetFields.map(field => (
                          <option key={field.value} value={field.value}>
                            {field.label} {field.required && '*'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePreview}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Preview Data
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Preview & Validate
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Review the data before importing ({rawData.length} rows)
                </p>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h5 className="text-red-800 dark:text-red-200 font-medium mb-2">
                    Validation Errors ({validationErrors.length})
                  </h5>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {validationErrors.slice(0, 5).map((error, index) => (
                      <li key={index}>
                        {error.row === -1 ? 'Mapping: ' : `Row ${error.row}: `}
                        {error.message}
                      </li>
                    ))}
                    {validationErrors.length > 5 && (
                      <li>... and {validationErrors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {mapping.map(map => (
                        <th key={map.targetField} className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          {targetFields.find(f => f.value === map.targetField)?.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {previewData.map((row, index) => (
                      <tr key={index} className="bg-white dark:bg-gray-800">
                        {mapping.map(map => (
                          <td key={map.targetField} className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {String(row[map.sourceColumn] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Back to Mapping
                </button>
                <button
                  onClick={handleImport}
                  disabled={validationErrors.length > 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  Import Data
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Importing your data...
              </h4>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {importedCount} of {rawData.length} rows processed
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Import Complete!
              </h4>
              <div className="space-y-2">
                <p className="text-green-600 dark:text-green-400">
                  Successfully imported {importedCount} transactions
                </p>
                {errorCount > 0 && (
                  <p className="text-red-600 dark:text-red-400">
                    {errorCount} rows had errors and were skipped
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}