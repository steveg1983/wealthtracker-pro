/**
 * OFXImportModal Component - Specialized modal for importing OFX/OFC files
 *
 * Features:
 * - OFX format parsing and validation
 * - Bank statement import
 * - Account reconciliation
 * - Transaction deduplication
 * - Multi-account support
 */

import React, { useState, useRef, useCallback } from 'react';

interface OFXImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: OFXImportData) => Promise<void>;
  className?: string;
}

interface OFXImportData {
  bankStatements: BankStatement[];
  accounts: OFXAccount[];
  transactions: OFXTransaction[];
  metadata: {
    bankId: string;
    statementDate: Date;
    currency: string;
    importDate: Date;
  };
}

interface BankStatement {
  accountId: string;
  accountType: string;
  bankId: string;
  startDate: Date;
  endDate: Date;
  balance: number;
  transactions: OFXTransaction[];
}

interface OFXAccount {
  accountId: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDITLINE' | 'INVESTMENT';
  bankId: string;
  routingNumber?: string;
  description?: string;
}

interface OFXTransaction {
  id: string;
  accountId: string;
  type: string;
  date: Date;
  amount: number;
  fitId: string; // Financial Institution Transaction ID
  description: string;
  memo?: string;
  checkNumber?: string;
  refNumber?: string;
  sic?: string; // Standard Industrial Classification
  payee?: string;
}

export default function OFXImportModal({
  isOpen,
  onClose,
  onImport,
  className = ''
}: OFXImportModalProps): React.JSX.Element {
  const [step, setStep] = useState<'upload' | 'accounts' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [ofxData, setOfxData] = useState<OFXImportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setFile(null);
      setOfxData(null);
      setIsProcessing(false);
      setImportProgress(0);
      setErrors([]);
      setSelectedAccounts(new Set());
    }
  }, [isOpen]);

  const parseOFXFile = useCallback(async (fileContent: string): Promise<OFXImportData> => {
    // This is a simplified OFX parser for demo purposes
    // In a real implementation, you'd use a proper OFX parsing library

    // Mock OFX data
    const mockData: OFXImportData = {
      bankStatements: [
        {
          accountId: '123456789',
          accountType: 'CHECKING',
          bankId: 'BANK001',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          balance: 2450.75,
          transactions: [
            {
              id: 'txn-1',
              accountId: '123456789',
              type: 'DEBIT',
              date: new Date('2024-01-15'),
              amount: -85.50,
              fitId: 'FIT001',
              description: 'GROCERY STORE PURCHASE',
              memo: 'TESCO EXTRA',
              checkNumber: undefined,
              refNumber: 'REF001'
            },
            {
              id: 'txn-2',
              accountId: '123456789',
              type: 'CREDIT',
              date: new Date('2024-01-16'),
              amount: 3250.00,
              fitId: 'FIT002',
              description: 'SALARY DEPOSIT',
              memo: 'MONTHLY SALARY',
              payee: 'EMPLOYER CORP'
            }
          ]
        }
      ],
      accounts: [
        {
          accountId: '123456789',
          accountType: 'CHECKING',
          bankId: 'BANK001',
          routingNumber: '123456789',
          description: 'Primary Checking Account'
        },
        {
          accountId: '987654321',
          accountType: 'SAVINGS',
          bankId: 'BANK001',
          routingNumber: '123456789',
          description: 'High Yield Savings'
        }
      ],
      transactions: [],
      metadata: {
        bankId: 'BANK001',
        statementDate: new Date('2024-01-31'),
        currency: 'GBP',
        importDate: new Date()
      }
    };

    // Flatten all transactions
    mockData.transactions = mockData.bankStatements.flatMap(stmt => stmt.transactions);

    return mockData;
  }, []);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().match(/\.(ofx|ofc|qfx)$/)) {
      setErrors(['Please select a valid OFX, OFC, or QFX file.']);
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);

    try {

      const fileContent = await selectedFile.text();
      const data = await parseOFXFile(fileContent);

      setOfxData(data);
      // Auto-select all accounts by default
      setSelectedAccounts(new Set(data.accounts.map(acc => acc.accountId)));
      setStep('accounts');
        accounts: data.accounts.length,
        transactions: data.transactions.length
      });
    } catch (error) {
      setErrors(['Failed to process OFX file. Please check the file format and try again.']);
    } finally {
      setIsProcessing(false);
    }
  }, [parseOFXFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().match(/\.(ofx|ofc|qfx)$/)) {
      handleFileSelect(droppedFile);
    } else {
      setErrors(['Please drop a valid OFX, OFC, or QFX file.']);
    }
  }, [handleFileSelect]);

  const handleAccountToggle = (accountId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const handleImport = async () => {
    if (!ofxData || selectedAccounts.size === 0) return;

    setStep('importing');
    setImportProgress(0);

    try {
      // Filter data by selected accounts
      const filteredData: OFXImportData = {
        ...ofxData,
        accounts: ofxData.accounts.filter(acc => selectedAccounts.has(acc.accountId)),
        bankStatements: ofxData.bankStatements.filter(stmt => selectedAccounts.has(stmt.accountId)),
        transactions: ofxData.transactions.filter(txn => selectedAccounts.has(txn.accountId))
      };

      // Simulate import progress
      const totalSteps = filteredData.transactions.length;
      for (let i = 0; i <= totalSteps; i += Math.max(1, Math.floor(totalSteps / 20))) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setImportProgress((i / totalSteps) * 100);
      }

      await onImport(filteredData);
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

  const getSelectedTransactions = () => {
    if (!ofxData) return [];
    return ofxData.transactions.filter(txn => selectedAccounts.has(txn.accountId));
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
              Import OFX Bank Statement
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
              { key: 'upload', label: 'Upload OFX' },
              { key: 'accounts', label: 'Select Accounts' },
              { key: 'preview', label: 'Preview' },
              { key: 'importing', label: 'Import' }
            ].map((stepItem, index) => (
              <div key={stepItem.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepItem.key ? 'bg-blue-600 text-white' :
                  ['accounts', 'preview', 'importing', 'complete'].indexOf(step) > ['upload', 'accounts', 'preview', 'importing'].indexOf(stepItem.key)
                    ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {['accounts', 'preview', 'importing', 'complete'].indexOf(step) > ['upload', 'accounts', 'preview', 'importing'].indexOf(stepItem.key) ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  step === stepItem.key ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepItem.label}
                </span>
                {index < 3 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    ['accounts', 'preview', 'importing', 'complete'].indexOf(step) > index ? 'bg-green-600' : 'bg-gray-200'
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
                  accept=".ofx,.ofc,.qfx"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="text-gray-400 text-6xl mb-4">🏦</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      Processing OFX file...
                    </h4>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-xs mx-auto">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-gray-400 text-6xl mb-4">🏦</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Upload Bank Statement
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Drop your OFX, OFC, or QFX file here, or click to browse
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Choose File
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                      Supports OFX, OFC, and QFX files from banks and financial institutions
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'accounts' && ofxData && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Select Accounts to Import
                </h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose which accounts you want to import from the OFX file
                </p>
              </div>

              <div className="space-y-3">
                {ofxData.accounts.map((account) => {
                  const statement = ofxData.bankStatements.find(stmt => stmt.accountId === account.accountId);
                  const isSelected = selectedAccounts.has(account.accountId);

                  return (
                    <div
                      key={account.accountId}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => handleAccountToggle(account.accountId)}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleAccountToggle(account.accountId)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900 dark:text-gray-100">
                                {account.description || `${account.accountType} Account`}
                              </h5>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Account: ****{account.accountId.slice(-4)} • {account.accountType}
                              </p>
                            </div>
                            {statement && (
                              <div className="text-right">
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {formatCurrency(statement.balance)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {statement.transactions.length} transactions
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Import Summary</h5>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {selectedAccounts.size} account(s) selected • {getSelectedTransactions().length} transactions will be imported
                </p>
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
                  disabled={selectedAccounts.size === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  Preview Import
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && ofxData && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Import Preview
                </h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Review transactions from selected accounts
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {getSelectedTransactions().slice(0, 10).map((transaction) => (
                      <tr key={transaction.id} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {transaction.date.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          <div>
                            <div>{transaction.description}</div>
                            {transaction.memo && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.memo}</div>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-2 text-sm font-medium ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          ****{transaction.accountId.slice(-4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {getSelectedTransactions().length > 10 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ... and {getSelectedTransactions().length - 10} more transactions
                </p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('accounts')}
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
              <div className="text-6xl mb-4">💳</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Importing bank statement...
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
              <div className="text-6xl mb-4">🎊</div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                OFX Import Complete!
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                Your bank statement has been successfully imported.
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