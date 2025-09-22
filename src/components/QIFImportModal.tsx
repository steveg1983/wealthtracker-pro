/**
 * QIFImportModal Component - Specialized modal for importing QIF files
 *
 * Features:
 * - QIF format parsing and validation
 * - Account mapping and categorization
 * - Transaction deduplication
 * - Import configuration options
 * - Progress tracking and error handling
 */

import React, { useState, useRef, useCallback } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface QIFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: QIFTransaction[], options: ImportOptions) => Promise<void>;
  className?: string;
}

interface QIFTransaction {
  date: Date;
  amount: number;
  description: string;
  category?: string;
  memo?: string;
  payee?: string;
  cleared?: 'cleared' | 'reconciled' | 'uncleared';
  number?: string; // Check number
  address?: string[];
}

interface ImportOptions {
  targetAccount: string;
  duplicateHandling: 'skip' | 'import' | 'ask';
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  defaultCategory?: string;
  createNewCategories: boolean;
}

interface QIFParseResult {
  transactions: QIFTransaction[];
  accounts: string[];
  categories: string[];
  errors: string[];
  warnings: string[];
}

export default function QIFImportModal({
  isOpen,
  onClose,
  onImport,
  className = ''
}: QIFImportModalProps): React.JSX.Element {
  const [step, setStep] = useState<'upload' | 'configure' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<QIFParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    targetAccount: 'checking',
    duplicateHandling: 'skip',
    dateFormat: 'MDY',
    createNewCategories: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setFile(null);
      setParseResult(null);
      setIsProcessing(false);
      setImportProgress(0);
      setImportOptions({
        targetAccount: 'checking',
        duplicateHandling: 'skip',
        dateFormat: 'MDY',
        createNewCategories: true
      });
    }
  }, [isOpen]);

  const parseQIFFile = useCallback(async (fileContent: string): Promise<QIFParseResult> => {
    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);
    const transactions: QIFTransaction[] = [];
    const accounts = new Set<string>();
    const categories = new Set<string>();
    const errors: string[] = [];
    const warnings: string[] = [];

    let currentTransaction: Partial<QIFTransaction> = {};
    let currentAccount = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('!Type:')) {
        currentAccount = line.substring(6);
        accounts.add(currentAccount);
        continue;
      }

      if (line === '^') {
        // End of transaction
        if (currentTransaction.date && currentTransaction.amount !== undefined && currentTransaction.description) {
          transactions.push(currentTransaction as QIFTransaction);
          if (currentTransaction.category) {
            categories.add(currentTransaction.category);
          }
        } else {
          warnings.push(`Incomplete transaction on line ${i + 1}`);
        }
        currentTransaction = {};
        continue;
      }

      const code = line.charAt(0);
      const value = line.substring(1);

      switch (code) {
        case 'D': // Date
          try {
            currentTransaction.date = new Date(value);
            if (isNaN(currentTransaction.date.getTime())) {
              errors.push(`Invalid date format on line ${i + 1}: ${value}`);
            }
          } catch {
            errors.push(`Invalid date on line ${i + 1}: ${value}`);
          }
          break;
        case 'T': // Amount
          currentTransaction.amount = parseFloat(value);
          if (isNaN(currentTransaction.amount)) {
            errors.push(`Invalid amount on line ${i + 1}: ${value}`);
          }
          break;
        case 'P': // Payee
          currentTransaction.payee = value;
          if (!currentTransaction.description) {
            currentTransaction.description = value;
          }
          break;
        case 'M': // Memo
          currentTransaction.memo = value;
          if (!currentTransaction.description) {
            currentTransaction.description = value;
          }
          break;
        case 'L': // Category
          currentTransaction.category = value;
          break;
        case 'C': // Cleared status
          currentTransaction.cleared = value.toLowerCase() as QIFTransaction['cleared'];
          break;
        case 'N': // Number (check number)
          currentTransaction.number = value;
          break;
        case 'A': // Address line
          if (!currentTransaction.address) {
            currentTransaction.address = [];
          }
          currentTransaction.address.push(value);
          break;
        default:
          warnings.push(`Unknown QIF code '${code}' on line ${i + 1}`);
      }
    }

    return {
      transactions,
      accounts: Array.from(accounts),
      categories: Array.from(categories),
      errors,
      warnings
    };
  }, []);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.qif')) {
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      logger.debug('Processing QIF file:', selectedFile.name);

      const fileContent = await selectedFile.text();
      const result = await parseQIFFile(fileContent);

      if (result.errors.length > 0) {
        logger.error('QIF parsing errors:', result.errors);
      }

      setParseResult(result);
      setStep(result.errors.length > 0 ? 'upload' : 'configure');
      logger.debug('QIF file processed successfully', {
        transactions: result.transactions.length,
        accounts: result.accounts.length
      });
    } catch (error) {
      logger.error('Error processing QIF file:', error);
      setParseResult({
        transactions: [],
        accounts: [],
        categories: [],
        errors: ['Failed to process QIF file. Please check the file format.'],
        warnings: []
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parseQIFFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.qif')) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) return;

    setStep('importing');
    setImportProgress(0);

    try {
      // Simulate import progress
      const totalSteps = parseResult.transactions.length;
      for (let i = 0; i <= totalSteps; i += Math.max(1, Math.floor(totalSteps / 20))) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setImportProgress((i / totalSteps) * 100);
      }

      await onImport(parseResult.transactions, importOptions);
      setStep('complete');
      logger.debug('QIF import completed successfully');
    } catch (error) {
      logger.error('QIF import failed:', error);
      setParseResult(prev => prev ? {
        ...prev,
        errors: [...prev.errors, 'Import failed. Please try again.']
      } : null);
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

        <div className={`inline-block w-full max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl ${className}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Import QIF File
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
              { key: 'upload', label: 'Upload QIF' },
              { key: 'configure', label: 'Configure' },
              { key: 'preview', label: 'Preview' },
              { key: 'importing', label: 'Import' }
            ].map((stepItem, index) => (
              <div key={stepItem.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepItem.key ? 'bg-blue-600 text-white' :
                  ['configure', 'preview', 'importing', 'complete'].indexOf(step) > ['upload', 'configure', 'preview', 'importing'].indexOf(stepItem.key)
                    ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {['configure', 'preview', 'importing', 'complete'].indexOf(step) > ['upload', 'configure', 'preview', 'importing'].indexOf(stepItem.key) ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  step === stepItem.key ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepItem.label}
                </span>
                {index < 3 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    ['configure', 'preview', 'importing', 'complete'].indexOf(step) > index ? 'bg-green-600' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>

          {/* Error/Warning Messages */}
          {parseResult?.errors && parseResult.errors.length > 0 && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-red-800 dark:text-red-200 font-medium mb-2">
                Parse Errors
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {parseResult.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {parseResult?.warnings && parseResult.warnings.length > 0 && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                Warnings
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {parseResult.warnings.slice(0, 5).map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
                {parseResult.warnings.length > 5 && (
                  <li>... and {parseResult.warnings.length - 5} more warnings</li>
                )}
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
                  accept=".qif"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="text-gray-400 text-6xl mb-4">⚙️</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      Processing QIF file...
                    </h4>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-xs mx-auto">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-gray-400 text-6xl mb-4">📋</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Upload QIF File
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Drag and drop your Quicken QIF file here, or click to browse
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Choose QIF File
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                      Supports .qif files from Quicken, QuickBooks, and other financial software
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'configure' && parseResult && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Import Configuration
                </h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Configure how your QIF data should be imported
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Account
                  </label>
                  <select
                    value={importOptions.targetAccount}
                    onChange={(e) => setImportOptions({ ...importOptions, targetAccount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="checking">Checking Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="credit">Credit Card</option>
                    <option value="investment">Investment Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Format
                  </label>
                  <select
                    value={importOptions.dateFormat}
                    onChange={(e) => setImportOptions({ ...importOptions, dateFormat: e.target.value as ImportOptions['dateFormat'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="MDY">MM/DD/YYYY (US)</option>
                    <option value="DMY">DD/MM/YYYY (UK)</option>
                    <option value="YMD">YYYY/MM/DD (ISO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duplicate Handling
                  </label>
                  <select
                    value={importOptions.duplicateHandling}
                    onChange={(e) => setImportOptions({ ...importOptions, duplicateHandling: e.target.value as ImportOptions['duplicateHandling'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="skip">Skip duplicates</option>
                    <option value="import">Import all</option>
                    <option value="ask">Ask for each duplicate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Category (Optional)
                  </label>
                  <input
                    type="text"
                    value={importOptions.defaultCategory || ''}
                    onChange={(e) => setImportOptions({ ...importOptions, defaultCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Uncategorized"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importOptions.createNewCategories}
                    onChange={(e) => setImportOptions({ ...importOptions, createNewCategories: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Create new categories for unknown categories in QIF file
                  </span>
                </label>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Import Summary</h5>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• {parseResult.transactions.length} transactions found</li>
                  <li>• {parseResult.categories.length} categories detected</li>
                  <li>• {parseResult.accounts.length} accounts in file</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Preview Import
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && parseResult && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Import Preview
                </h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Review the first few transactions before importing
                </p>
              </div>

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
                    {parseResult.transactions.slice(0, 10).map((transaction, index) => (
                      <tr key={index} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {transaction.date.toLocaleDateString()}
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
                          {transaction.category || importOptions.defaultCategory || 'Uncategorized'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseResult.transactions.length > 10 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ... and {parseResult.transactions.length - 10} more transactions
                </p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('configure')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Import Transactions
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 text-center">
              <div className="text-6xl mb-4">📥</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Importing QIF data...
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
              <div className="text-6xl mb-4">✅</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                QIF Import Complete!
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                Your QIF file has been successfully imported.
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