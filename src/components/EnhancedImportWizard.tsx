import React, { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { Transaction } from '../types';
import { enhancedCsvImportService, type ColumnMapping, type ImportProfile } from '../services/enhancedCsvImportService';
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
  SaveIcon,
  DownloadIcon,
  RefreshCwIcon,
  PlayIcon,
  StopIcon,
  WrenchIcon,
  FolderIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import BankFormatSelector from './BankFormatSelector';
import ImportRulesManager from './ImportRulesManager';
import { logger } from '../services/loggingService';

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
}

export default function EnhancedImportWizard({ isOpen, onClose }: EnhancedImportWizardProps): React.JSX.Element {
  const { accounts, transactions, addTransaction, categories, hasTestData, clearAllData } = useApp();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('files');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedBankFormat, setSelectedBankFormat] = useState<string>('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
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

  const handleBankFormatSelected = (bankKey: string, bankName: string) => {
    setSelectedBankFormat(bankKey);
    
    // Auto-generate mappings if it's not a custom format
    if (bankKey !== 'custom') {
      const bankMappings = enhancedCsvImportService.getBankMappings(bankKey);
      setMappings(bankMappings);
    }
  };

  const processFiles = async () => {
    if (hasTestData && !showTestDataWarning) {
      setShowTestDataWarning(true);
      return;
    }

    setIsProcessing(true);
    setCurrentStep('result');
    
    let totalImported = 0;
    let totalDuplicates = 0;
    let successfulFiles = 0;
    
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
                const isDuplicate = transactions.some(t => 
                  t.date === transaction.date &&
                  t.amount === transaction.amount &&
                  t.description === transaction.description
                );
                
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
                  logger.warn('Skipping transaction with missing required fields:', transaction);
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
              duplicates
            } : f
          ));
          
          totalImported += imported;
          totalDuplicates += duplicates;
          successfulFiles++;
          
        } catch (error) {
          logger.error(`Error processing file ${fileInfo.name}:`, error);
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
    setShowTestDataWarning(false);
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer"
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
                        <FileTextIcon size={20} className="text-gray-600 dark:text-gray-500" />
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
                  <RefreshCwIcon size={24} className="animate-spin text-gray-600" />
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
                  <div className="bg-blue-50 dark:bg-gray-900/20 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                      {importResult.totalFiles}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Files Processed</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
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
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : file.status === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {file.status === 'success' ? (
                          <CheckIcon size={20} className="text-green-600 dark:text-green-400" />
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
                      isActive ? 'text-gray-600 dark:text-gray-500' : 
                      isPast ? 'text-green-600 dark:text-green-400' : 
                      'text-gray-400 dark:text-gray-600'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isActive ? 'bg-gray-600 text-white' :
                        isPast ? 'bg-green-600 text-white' :
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
                        isPast ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
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
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Test Data Warning Modal */}
      {showTestDataWarning && (
        <Modal 
          isOpen={true} 
          onClose={() => setShowTestDataWarning(false)}
          title="Test Data Detected"
          size="md"
        >
          <ModalBody>
            <div className="flex items-start gap-3">
              <AlertCircleIcon size={24} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-900 dark:text-white mb-2">
                  Test data has been detected in your application. Importing real transaction data will mix with test data.
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Would you like to clear all test data before importing your real transactions?
                </p>
              </div>
            </div>
          </ModalBody>
          
          <ModalFooter>
            <div className="flex gap-3 w-full justify-end">
              <button
                onClick={() => {
                  setShowTestDataWarning(false);
                  processFiles();
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Keep Test Data
              </button>
              <button
                onClick={() => {
                  clearAllData();
                  setShowTestDataWarning(false);
                  processFiles();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Clear Test Data
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
