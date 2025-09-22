/**
 * ImportDataModal Component - Modal for importing financial data
 *
 * Features:
 * - File upload and parsing
 * - Format detection and validation
 * - Import preview and confirmation
 * - Progress tracking
 * - Error handling and reporting
 */

import React, { useState, useRef, useCallback } from 'react';

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportedData) => Promise<void>;
  supportedFormats?: string[];
  className?: string;
}

interface ImportedData {
  transactions: ImportedTransaction[];
  accounts: ImportedAccount[];
  categories: ImportedCategory[];
  metadata: {
    source: string;
    importDate: Date;
    format: string;
    totalRecords: number;
  };
}

interface ImportedTransaction {
  date: string;
  amount: number;
  description: string;
  category?: string;
  account?: string;
  merchant?: string;
  type?: 'income' | 'expense' | 'transfer';
}

interface ImportedAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan';
  balance?: number;
  currency: string;
}

interface ImportedCategory {
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color?: string;
}

const supportedFormatsDefault = ['.csv', '.xlsx', '.xls', '.qif', '.ofx', '.json'];

export default function ImportDataModal({
  isOpen,
  onClose,
  onImport,
  supportedFormats = supportedFormatsDefault,
  className = ''
}: ImportDataModalProps): React.JSX.Element {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setFile(null);
      setImportData(null);
      setIsProcessing(false);
      setImportProgress(0);
      setErrors([]);
      setWarnings([]);
    }
  }, [isOpen]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);
    setWarnings([]);

    try {

      // Simulate file processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock imported data based on file type
      const mockData: ImportedData = {
        transactions: [
          {
            date: '2024-01-15',
            amount: -85.50,
            description: 'GROCERY STORE',
            category: 'Groceries',
            account: 'Checking',
            merchant: 'Tesco',
            type: 'expense'
          },
          {
            date: '2024-01-16',
            amount: 3250.00,
            description: 'SALARY DEPOSIT',
            category: 'Salary',
            account: 'Checking',
            type: 'income'
          },
          {
            date: '2024-01-17',
            amount: -45.20,
            description: 'PETROL STATION',
            category: 'Transport',
            account: 'Credit Card',
            merchant: 'Shell',
            type: 'expense'
          }
        ],
        accounts: [
          {
            name: 'Main Checking',
            type: 'checking',
            balance: 2450.30,
            currency: 'GBP'
          },
          {
            name: 'Credit Card',
            type: 'credit',
            balance: -1250.75,
            currency: 'GBP'
          }
        ],
        categories: [
          { name: 'Groceries', type: 'expense', color: '#10B981' },
          { name: 'Salary', type: 'income', color: '#3B82F6' },
          { name: 'Transport', type: 'expense', color: '#F59E0B' }
        ],
        metadata: {
          source: selectedFile.name,
          importDate: new Date(),
          format: selectedFile.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
          totalRecords: 3
        }
      };

      // Add some mock warnings
      const newWarnings = [];
      if (mockData.transactions.some(t => !t.category)) {
        newWarnings.push('Some transactions are missing categories');
      }
      if (mockData.transactions.length > 100) {
        newWarnings.push('Large import detected - this may take a while');
      }

      setImportData(mockData);
      setWarnings(newWarnings);
      setStep('preview');
    } catch (error) {
      setErrors(['Failed to process the selected file. Please check the format and try again.']);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && supportedFormats.some(format => droppedFile.name.toLowerCase().endsWith(format))) {
      handleFileSelect(droppedFile);
    } else {
      setErrors(['Unsupported file format. Please use one of: ' + supportedFormats.join(', ')]);
    }
  }, [handleFileSelect, supportedFormats]);

  const handleImport = async () => {
    if (!importData) return;

    setStep('importing');
    setImportProgress(0);

    try {
      // Simulate import progress
      const totalSteps = 10;
      for (let i = 0; i <= totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setImportProgress((i / totalSteps) * 100);
      }

      await onImport(importData);
      setStep('complete');
    } catch (error) {
      setErrors(['Import failed. Please try again or contact support.']);
      setStep('preview');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
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
              Import Financial Data
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
              { key: 'upload', label: 'Upload File' },
              { key: 'preview', label: 'Preview Data' },
              { key: 'importing', label: 'Import' }
            ].map((stepItem, index) => (
              <div key={stepItem.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepItem.key ? 'bg-blue-600 text-white' :
                  ['preview', 'importing', 'complete'].indexOf(step) > ['upload', 'preview', 'importing'].indexOf(stepItem.key)
                    ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {['preview', 'importing', 'complete'].indexOf(step) > ['upload', 'preview', 'importing'].indexOf(stepItem.key) ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  step === stepItem.key ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepItem.label}
                </span>
                {index < 2 && (
                  <div className={`w-12 h-0.5 mx-4 ${
                    ['preview', 'importing', 'complete'].indexOf(step) > index ? 'bg-green-600' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-red-800 dark:text-red-200 font-medium mb-2">
                Import Errors
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning Messages */}
          {warnings.length > 0 && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                Warnings
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

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
                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="text-gray-400 text-6xl mb-4">⏳</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      Processing file...
                    </h4>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-xs mx-auto">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-gray-400 text-6xl mb-4">📊</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Upload your financial data
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
                  </>
                )}
              </div>

              {file && !isProcessing && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-3">📁</div>
                    <div>
                      <p className="text-blue-800 dark:text-blue-200 font-medium">
                        {file.name}
                      </p>
                      <p className="text-blue-600 dark:text-blue-400 text-sm">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && importData && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Import Preview
                </h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Review the data before importing ({importData.metadata.totalRecords} records)
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h5 className="font-medium text-blue-900 dark:text-blue-100">Transactions</h5>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {importData.transactions.length}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h5 className="font-medium text-green-900 dark:text-green-100">Accounts</h5>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importData.accounts.length}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h5 className="font-medium text-purple-900 dark:text-purple-100">Categories</h5>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {importData.categories.length}
                  </p>
                </div>
              </div>

              {/* Transaction Preview */}
              <div>
                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Sample Transactions
                </h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {importData.transactions.slice(0, 5).map((transaction, index) => (
                        <tr key={index} className="bg-white dark:bg-gray-800">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {new Date(transaction.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {transaction.description}
                          </td>
                          <td className={`px-4 py-2 text-sm font-medium ${
                            transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {transaction.category || 'Uncategorized'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importData.transactions.length > 5 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    ... and {importData.transactions.length - 5} more transactions
                  </p>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Import Data
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 text-center">
              <div className="text-6xl mb-4">⚡</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Importing your data...
              </h4>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 max-w-md mx-auto">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {Math.round(importProgress)}% complete
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Import Complete!
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                Your financial data has been successfully imported.
              </p>
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