import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { Transaction } from '../types';
import { enhancedCsvImportService, type ColumnMapping } from '../services/enhancedCsvImportService';
import { importRulesService } from '../services/importRulesService';
import { ofxImportService } from '../services/ofxImportService';
import { qifImportService } from '../services/qifImportService';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  RefreshCwIcon,
  PlayIcon,
  FolderIcon
} from './icons';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { isDuplicateImport } from '../utils/importDedupe';
import {
  formatStatementDay,
  planStatementBankBalance,
  type BankBalanceRecord
} from '../utils/statementBankBalance';
import { formatCurrency } from '../utils/currency-decimal';
import { createScopedLogger } from '../loggers/scopedLogger';
import BankFormatSelector from './BankFormatSelector';
import ImportRulesManager from './ImportRulesManager';

interface EnhancedImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'files' | 'format' | 'mapping' | 'rules' | 'preview' | 'result';

interface FileInfo {
  file: File;
  name: string;
  size: string;
  type: 'csv' | 'ofx' | 'qif' | 'unknown';
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  imported?: number;
  duplicates?: number;
  bankFormat?: string;
  /** Set when this file's closing balance became the account's Bank Balance. */
  bankBalanceSet?: string;
  /** Set when that write failed — the transactions still landed. */
  bankBalanceWarning?: string;
  /**
   * Rows the file describes that the parser could not use. Reported because a
   * payment that goes missing between the bank's file and the register, with
   * nothing said about it, is a register that cannot be reconciled.
   */
  unreadableRows?: number;
}

interface ImportSummary {
  totalFiles: number;
  successfulFiles: number;
  totalTransactions: number;
  totalDuplicates: number;
}

export default function EnhancedImportWizard({ isOpen, onClose }: EnhancedImportWizardProps): React.JSX.Element {
  const { accounts, transactions, addTransaction, categories, updateAccount } = useApp();
  const logger = useMemo(() => createScopedLogger('EnhancedImportWizard'), []);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('files');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedBankFormat, setSelectedBankFormat] = useState<string>('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  
  // File handling
  const detectFileType = (filename: string): FileInfo['type'] => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'csv': return 'csv';
      case 'ofx': return 'ofx';
      case 'qif': return 'qif';
      default: return 'unknown';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    else return Math.round(bytes / 1048576) + ' MB';
  };

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const fileInfos: FileInfo[] = selectedFiles.map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: detectFileType(file.name),
      status: 'pending'
    }));
    
    const validFiles = fileInfos.filter(f => f.type !== 'unknown');
    const invalidFiles = fileInfos.filter(f => f.type === 'unknown');
    
    if (invalidFiles.length > 0) {
      alert(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}`);
    }
    
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    const fileInfos: FileInfo[] = droppedFiles.map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: detectFileType(file.name),
      status: 'pending'
    }));
    
    const validFiles = fileInfos.filter(f => f.type !== 'unknown');
    const invalidFiles = fileInfos.filter(f => f.type === 'unknown');
    
    if (invalidFiles.length > 0) {
      alert(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}`);
    }
    
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  }, []);

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleBankFormatSelected = (bankKey: string, _bankName: string) => {
    setSelectedBankFormat(bankKey);
    
    // Auto-generate mappings if it's not a custom format
    if (bankKey !== 'custom') {
      const bankMappings = enhancedCsvImportService.getBankMappings(bankKey);
      setMappings(bankMappings);
    }
  };

  // Retired 2026-08-07: the "Test Data Detected — clear it first?" step that
  // used to interrupt this. It read a flag nothing could keep true, and its
  // clear button called a context reset that only emptied React state, so on a
  // cloud login the data came back on the next load. The Review step now says
  // plainly what the import does to existing data.
  /**
   * Give the account the statement's own closing balance, so Reconciliation
   * has something to check the rows just imported against.
   *
   * Only ever `bankBalance` — never `balance`, which the transactions have
   * already moved.
   *
   * Only on an IDENTIFIER match: this wizard never asks which account an OFX
   * file belongs to, so anything less is a guess made with nobody watching.
   * A guess is good enough to place transactions, which stay visible and
   * removable; it is not good enough to redefine what an account reconciles
   * against.
   */
  const applyStatementBankBalance = async (
    result: Awaited<ReturnType<typeof ofxImportService.importTransactions>>,
    writtenThisRun: Map<string, BankBalanceRecord>
  ): Promise<{ note?: string; warning?: string }> => {
    const account = result.matchedAccount;
    if (!account) return {};

    const plan = planStatementBankBalance(
      result.statementBalance,
      writtenThisRun.get(account.id) ?? account,
      { destinationConfirmed: result.matchConfidence === 'identifier' }
    );
    if (plan.kind !== 'set') return {};

    try {
      await updateAccount(account.id, plan.updates);
      writtenThisRun.set(account.id, plan.updates);
      return {
        note: `Bank Balance ${formatCurrency(plan.amount, account.currency)} as at ${formatStatementDay(plan.dateAsOf)}`
      };
    } catch (error) {
      // The transactions are already in; report what did not happen instead of
      // failing the file.
      logger.error('Failed to set bank balance from statement', error as Error);
      return { warning: `Couldn't update ${account.name}'s Bank Balance` };
    }
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setCurrentStep('result');

    let totalImported = 0;
    let totalDuplicates = 0;
    let successfulFiles = 0;
    // Statements written during THIS run, because `accounts` is React state and
    // does not refresh between files: without it, two statements for one
    // account would both be judged against the account as it stood before the
    // run, and the older could overwrite the newer.
    const bankBalancesWrittenThisRun = new Map<string, BankBalanceRecord>();

    try {
      for (let i = 0; i < files.length; i++) {
        const fileInfo = files[i];
        setCurrentFileIndex(i);

        setFiles(prev => prev.map((f, index) =>
          index === i ? { ...f, status: 'processing' } : f
        ));

        try {
          const content = await fileInfo.file.text();
          let imported = 0;
          let duplicates = 0;
          let bankBalanceSet: string | undefined;
          let bankBalanceWarning: string | undefined;
          let unreadableRows = 0;

          switch (fileInfo.type) {
            case 'csv': {
              const parsed = enhancedCsvImportService.parseCSV(content);
              const usedMappings = selectedBankFormat && selectedBankFormat !== 'custom' 
                ? enhancedCsvImportService.getBankMappings(selectedBankFormat)
                : mappings;
              
              const preview = enhancedCsvImportService.generatePreview(parsed.data, usedMappings);
              
              // Apply import rules
              const processedTransactions = preview.transactions.map(t => 
                importRulesService.applyRules(t)
              ).filter(t => t !== null) as Partial<Transaction>[];
              
              for (const transaction of processedTransactions) {
                // Dates are compared as instants: `===` on two Date objects is
                // identity, so this test never once matched and nothing was
                // ever detected as a duplicate.
                const isDuplicate = isDuplicateImport(transactions, transaction);

                if (!isDuplicate && transaction.date && transaction.amount !== undefined && transaction.type && transaction.category && transaction.accountId && transaction.description !== undefined) {
                  addTransaction({
                    date: transaction.date,
                    amount: transaction.amount,
                    type: transaction.type,
                    category: transaction.category,
                    accountId: transaction.accountId,
                    description: transaction.description,
                    merchant: transaction.merchant,
                    tags: transaction.tags || [],
                    notes: transaction.notes
                  });
                  imported++;
                } else if (!isDuplicate) {
                  // Skip transactions with missing required fields
                  logger.warn?.('Skipping transaction with missing required fields', transaction);
                } else {
                  duplicates++;
                }
              }
              break;
            }
            
            case 'ofx': {
              const result = await ofxImportService.importTransactions(
                content,
                accounts,
                transactions,
                { 
                  categories,
                  autoCategorize: true
                }
              );
              
              for (const transaction of result.transactions) {
                addTransaction(transaction);
                imported++;
              }
              duplicates = result.duplicates;
              unreadableRows = result.unreadableRows;

              const balanceOutcome = await applyStatementBankBalance(result, bankBalancesWrittenThisRun);
              bankBalanceSet = balanceOutcome.note;
              bankBalanceWarning = balanceOutcome.warning;
              break;
            }

            case 'qif': {
              const result = await qifImportService.importTransactions(
                content,
                accounts[0]?.id || '',
                transactions,
                { 
                  categories,
                  autoCategorize: true
                }
              );
              
              for (const transaction of result.transactions) {
                addTransaction(transaction);
                imported++;
              }
              duplicates = result.duplicates;
              break;
            }
          }

          setFiles(prev => prev.map((f, index) =>
            index === i ? {
              ...f,
              status: 'success',
              imported,
              duplicates,
              bankBalanceSet,
              bankBalanceWarning,
              unreadableRows
            } : f
          ));
          
          totalImported += imported;
          totalDuplicates += duplicates;
          successfulFiles++;
          
        } catch (error) {
          logger.error(`Error processing file ${fileInfo.name}`, error as Error);
          setFiles(prev => prev.map((f, index) => 
            index === i ? { 
              ...f, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            } : f
          ));
        }
      }
      
      setImportResult({
        totalFiles: files.length,
        successfulFiles,
        totalTransactions: totalImported,
        totalDuplicates
      });
      
    } finally {
      setIsProcessing(false);
      setCurrentFileIndex(-1);
    }
  };

  const resetWizard = () => {
    setCurrentStep('files');
    setFiles([]);
    setSelectedBankFormat('');
    setMappings([]);
    setImportResult(null);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'files':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Select Files to Import
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Choose CSV, OFX, or QIF files from your bank or financial institution.
              </p>
            </div>

            {/* File Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              <UploadIcon size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Drag and drop files here
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <input
                type="file"
                multiple
                accept=".csv,.ofx,.qif"
                onChange={handleFileSelection}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] cursor-pointer"
              >
                <FolderIcon size={16} />
                Choose Files
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Selected Files ({files.length})
                </h4>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileTextIcon size={20} className="text-blue-700 dark:text-blue-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {file.size} • {file.type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'format':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Select Bank Format
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Choose your bank or financial institution to automatically map columns.
              </p>
            </div>
            
            <BankFormatSelector
              onBankSelected={handleBankFormatSelected}
              selectedBank={selectedBankFormat}
            />
          </div>
        );

      case 'rules':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Import Rules & Transformations
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Set up rules to automatically categorize and transform your imported transactions.
              </p>
            </div>
            
            <ImportRulesManager />

            {/* Last thing before "Start Import", so it says what the import
                will actually do: every path here only ADDS transactions —
                nothing existing is edited or removed — and rows matching one
                already loaded are skipped and counted as duplicates. */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
              <AlertCircleIcon size={18} className="mt-0.5 flex-shrink-0" />
              <p>
                Importing adds these transactions to your existing data — nothing is
                replaced or deleted. Anything matching a transaction you already have
                is skipped and counted as a duplicate.
              </p>
            </div>
          </div>
        );

      case 'result':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Import Results
              </h3>
            </div>

            {isProcessing ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3 mb-4">
                  <RefreshCwIcon size={24} className="animate-spin text-blue-600" />
                  <span className="text-lg font-medium text-gray-900 dark:text-white">
                    Processing Files...
                  </span>
                </div>
                {currentFileIndex >= 0 && (
                  <p className="text-gray-600 dark:text-gray-400">
                    Processing {files[currentFileIndex]?.name} ({currentFileIndex + 1} of {files.length})
                  </p>
                )}
              </div>
            ) : importResult ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {importResult.totalFiles}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Files Processed</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {importResult.successfulFiles}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Successful</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {importResult.totalTransactions}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Imported</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {importResult.totalDuplicates}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates</p>
                  </div>
                </div>

                {/* File Details */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">File Details</h4>
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        file.status === 'success'
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : file.status === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {file.status === 'success' ? (
                          <CheckIcon size={20} className="text-blue-600 dark:text-blue-400" />
                        ) : file.status === 'error' ? (
                          <XIcon size={20} className="text-red-600 dark:text-red-400" />
                        ) : (
                          <FileTextIcon size={20} className="text-gray-600 dark:text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {file.name}
                          </p>
                          {file.error && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {file.error}
                            </p>
                          )}
                        </div>
                      </div>
                      {file.status === 'success' && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {file.imported} imported
                          </p>
                          {file.duplicates && file.duplicates > 0 && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {file.duplicates} duplicates
                            </p>
                          )}
                          {/* Present only when a balance was actually written,
                              so nothing renders when nothing happened. */}
                          {file.bankBalanceSet && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {file.bankBalanceSet}
                            </p>
                          )}
                          {file.bankBalanceWarning && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              {file.bankBalanceWarning}
                            </p>
                          )}
                          {file.unreadableRows !== undefined && file.unreadableRows > 0 && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              {file.unreadableRows === 1
                                ? 'one row could not be read and is missing from the register'
                                : `${file.unreadableRows} rows could not be read and are missing from the register`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 'files': return files.length > 0;
      case 'format': return selectedBankFormat !== '';
      case 'rules': return true; // Optional step
      default: return false;
    }
  };

  const getNextStep = (): WizardStep => {
    switch (currentStep) {
      case 'files': return 'format';
      case 'format': return 'rules';
      case 'rules': return 'result';
      default: return 'files';
    }
  };

  const getPrevStep = (): WizardStep => {
    switch (currentStep) {
      case 'format': return 'files';
      case 'rules': return 'format';
      case 'result': return 'rules';
      default: return 'files';
    }
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Enhanced Import Wizard" 
        size="xl"
      >
        <ModalBody>
          {/* Progress Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              {['files', 'format', 'rules', 'result'].map((step, index) => {
                const stepNumber = index + 1;
                const isActive = currentStep === step;
                const isPast = ['files', 'format', 'rules', 'result'].indexOf(currentStep) > index;
                
                return (
                  <React.Fragment key={step}>
                    <div className={`flex items-center gap-2 ${
                      isActive ? 'text-blue-700 dark:text-blue-400' : 
                      isPast ? 'text-blue-600 dark:text-blue-400' : 
                      'text-gray-400 dark:text-gray-600'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isActive ? 'bg-[#1a2332] text-white' :
                        isPast ? 'bg-blue-600 text-white' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {isPast ? <CheckIcon size={16} /> : stepNumber}
                      </div>
                      <span className="text-sm font-medium capitalize hidden sm:inline">
                        {step === 'files' ? 'Select Files' :
                         step === 'format' ? 'Bank Format' :
                         step === 'rules' ? 'Import Rules' :
                         'Results'}
                      </span>
                    </div>
                    {index < 3 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        isPast ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {renderStepContent()}
        </ModalBody>
        
        <ModalFooter>
          <div className="flex justify-between w-full">
            <div>
              {currentStep !== 'files' && currentStep !== 'result' && (
                <button
                  onClick={() => setCurrentStep(getPrevStep())}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <ChevronLeftIcon size={16} />
                  Back
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              {currentStep === 'result' && (
                <button
                  onClick={resetWizard}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <RefreshCwIcon size={16} />
                  Import More
                </button>
              )}
              
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {currentStep === 'result' ? 'Done' : 'Cancel'}
              </button>
              
              {currentStep !== 'result' && (
                <button
                  onClick={() => {
                    if (currentStep === 'rules') {
                      processFiles();
                    } else {
                      setCurrentStep(getNextStep());
                    }
                  }}
                  disabled={!canProceedToNext()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {currentStep === 'rules' ? (
                    <>
                      <PlayIcon size={16} />
                      Start Import
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRightIcon size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </ModalFooter>
      </Modal>

    </>
  );
}
