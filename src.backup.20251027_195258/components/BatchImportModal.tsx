import React, { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { enhancedCsvImportService } from '../services/enhancedCsvImportService';
import { ofxImportService } from '../services/ofxImportService';
import { qifImportService } from '../services/qifImportService';
import { Modal } from './common/Modal';
import {
  UploadIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  FolderIcon,
  PlayIcon,
  StopIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import type { Transaction } from '../types';
import { Decimal, formatPercentageValue, toDecimal } from '@wealthtracker/utils';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FileInfo {
  file: File;
  name: string;
  size: string;
  type: 'csv' | 'ofx' | 'qif' | 'unknown';
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  imported?: number;
  duplicates?: number;
  accountMatched?: string;
}

export default function BatchImportModal({ isOpen, onClose }: BatchImportModalProps): React.JSX.Element {
  const { accounts, transactions, addTransaction, clearAllData } = useApp();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    totalFiles: number;
    successfulFiles: number;
    totalTransactions: number;
    totalDuplicates: number;
  } | null>(null);

  const detectFileType = useCallback((filename: string): FileInfo['type'] => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'csv': return 'csv';
      case 'ofx': return 'ofx';
      case 'qif': return 'qif';
      default: return 'unknown';
    }
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    const size = toDecimal(bytes);

    if (size.lessThan(1024)) {
      return `${size.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()} bytes`;
    }

    if (size.lessThan(1048576)) {
      const kilobytes = size.dividedBy(1024);
      return `${kilobytes.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()} KB`;
    }

    const megabytes = size.dividedBy(1048576).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
    const formatted = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(megabytes);
    return `${formatted} MB`;
  }, []);

  const mapToFileInfos = useCallback((inputFiles: File[]): FileInfo[] => (
    inputFiles.map((file) => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: detectFileType(file.name),
      status: 'pending',
    }))
  ), [detectFileType, formatFileSize]);

  const separateFilesBySupport = useCallback((entries: FileInfo[]) => {
    const valid: FileInfo[] = [];
    const invalid: FileInfo[] = [];

    entries.forEach((entry) => {
      if (entry.type === 'unknown') {
        invalid.push(entry);
      } else {
        valid.push(entry);
      }
    });

    return { valid, invalid };
  }, []);

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const { valid, invalid } = separateFilesBySupport(mapToFileInfos(selectedFiles));

    if (invalid.length > 0) {
      alert(`Unsupported file types: ${invalid.map((file) => file.name).join(', ')}`);
    }

    if (valid.length > 0) {
      setFiles(valid);
    } else {
      setFiles([]);
    }
  }, [mapToFileInfos, separateFilesBySupport]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    const { valid, invalid } = separateFilesBySupport(mapToFileInfos(droppedFiles));

    if (invalid.length > 0) {
      alert(`Unsupported file types: ${invalid.map((file) => file.name).join(', ')}`);
    }

    if (valid.length > 0) {
      setFiles((prevFiles) => [...prevFiles, ...valid]);
    }
  }, [mapToFileInfos, separateFilesBySupport]);

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const processFile = async (fileInfo: FileInfo): Promise<FileInfo> => {
    let imported = 0;
    let duplicates = 0;
    let accountMatched = fileInfo.accountMatched ?? '';

    try {
      const content = await fileInfo.file.text();

      switch (fileInfo.type) {
        case 'csv': {
          const parsed = enhancedCsvImportService.parseCSV(content);
          const mappings = enhancedCsvImportService.suggestMappings(parsed.headers, 'transaction');
          const preview = enhancedCsvImportService.generatePreview(parsed.data, mappings);

          const possibleAccounts = new Set<string>();
          preview.transactions.forEach((transaction) => {
            if (transaction.accountId) {
              possibleAccounts.add(transaction.accountId);
            }
          });

          if (possibleAccounts.size === 1) {
            accountMatched = Array.from(possibleAccounts)[0] ?? accountMatched;
          } else if (possibleAccounts.size === 0 && accounts[0]) {
            accountMatched = accounts[0].id;
          }

          for (const transaction of preview.transactions) {
            const description = transaction.description ?? '';
            const amount = transaction.amount;
            const dateValue = transaction.date ? new Date(transaction.date) : null;
            const category = transaction.category ?? '';
            const type = transaction.type ?? 'expense';

            const isDuplicate = transactions.some((existing) =>
              existing.description === description &&
              existing.amount === amount &&
              existing.date?.valueOf() === dateValue?.valueOf()
            );

            if (!isDuplicate && dateValue && amount !== undefined && description && category && type) {
              const payload: Omit<Transaction, 'id'> = {
                date: dateValue,
                amount,
                description,
                category,
                type,
                accountId: transaction.accountId || accountMatched,
              };

              if (transaction.tags && transaction.tags.length > 0) {
                payload.tags = transaction.tags;
              }
              if (transaction.notes && transaction.notes.length > 0) {
                payload.notes = transaction.notes;
              }

              await addTransaction(payload);
              imported += 1;
            } else {
              duplicates += 1;
            }
          }
          break;
        }
        case 'ofx': {
          const result = await ofxImportService.importTransactions(content, accounts, transactions, {});
          accountMatched = result.matchedAccount?.id ?? accounts[0]?.id ?? accountMatched;

          for (const transaction of result.transactions) {
            await addTransaction(transaction);
            imported += 1;
          }
          duplicates = result.duplicates;
          break;
        }
        case 'qif': {
          const defaultAccountId = accounts[0]?.id ?? accountMatched;
          if (!defaultAccountId) {
            throw new Error('No account available for QIF import');
          }
          const result = await qifImportService.importTransactions(content, defaultAccountId, transactions, {});
          accountMatched = defaultAccountId;

          for (const transaction of result.transactions) {
            await addTransaction(transaction);
            imported += 1;
          }
          duplicates = result.duplicates;
          break;
        }
        default: {
          throw new Error('Unsupported file type');
        }
      }

      return {
        ...fileInfo,
        status: 'success',
        imported,
        duplicates,
        accountMatched,
      };
    } catch (error) {
      return {
        ...fileInfo,
        status: 'error',
        error: error instanceof Error ? error.message : 'Import failed',
      };
    }
  };

  const startBatchImport = async () => {
    if (transactions.length > 0 && !showTestDataWarning) {
      setShowTestDataWarning(true);
      return;
    }

    if (transactions.length > 0) {
      clearAllData();
    }

    setIsProcessing(true);
    setImportSummary(null);

    let totalImported = 0;
    let totalDuplicates = 0;
    let successfulFiles = 0;

    const filesSnapshot = files.map((file) => ({ ...file }));

    for (let index = 0; index < filesSnapshot.length; index += 1) {
      const current = filesSnapshot[index];
      if (!current || current.status !== 'pending') {
        continue;
      }

      setCurrentFileIndex(index);
      const processingFile: FileInfo = { ...current, status: 'processing' };
      filesSnapshot[index] = processingFile;
      setFiles([...filesSnapshot]);

      const processedFile = await processFile(processingFile);
      filesSnapshot[index] = processedFile;
      setFiles([...filesSnapshot]);

      if (processedFile.status === 'success') {
        successfulFiles += 1;
        totalImported += processedFile.imported ?? 0;
        totalDuplicates += processedFile.duplicates ?? 0;
      }
    }

    setFiles(filesSnapshot);
    setImportSummary({
      totalFiles: filesSnapshot.length,
      successfulFiles,
      totalTransactions: totalImported,
      totalDuplicates,
    });

    setIsProcessing(false);
    setCurrentFileIndex(-1);
  };

  const reset = () => {
    setFiles([]);
    setImportSummary(null);
    setShowTestDataWarning(false);
  };

  const getFileIcon = (type: FileInfo['type']) => {
    switch (type) {
      case 'csv': return '📊';
      case 'ofx': return '🏦';
      case 'qif': return '💰';
      default: return '📄';
    }
  };

  const getStatusIcon = (status: FileInfo['status']) => {
    switch (status) {
      case 'success': return <CheckIcon size={16} className="text-green-600" />;
      case 'error': return <XIcon size={16} className="text-red-600" />;
      case 'processing': return <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />;
      default: return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Batch Import Files"
      size="xl"
    >
      <div className="p-6">
        {showTestDataWarning && transactions.length > 0 ? (
          <div className="text-center">
            <AlertCircleIcon size={48} className="mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Clear Test Data?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have test data loaded. Importing real data will clear all existing test data.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowTestDataWarning(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={startBatchImport}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Clear Test Data & Import
              </button>
            </div>
          </div>
        ) : importSummary ? (
          <div className="text-center">
            <CheckIcon size={48} className="mx-auto text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-4">Import Complete!</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Files Processed</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {importSummary.successfulFiles}/{importSummary.totalFiles}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Transactions Imported</p>
                  <p className="text-2xl font-bold text-green-600">
                    {importSummary.totalTransactions}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Duplicates Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {importSummary.totalDuplicates}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatPercentageValue(
                      toDecimal(importSummary.successfulFiles)
                        .dividedBy(importSummary.totalFiles)
                        .times(100),
                      0
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Import More Files
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File Upload Area */}
            {files.length === 0 ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center hover:border-primary transition-colors"
              >
                <FolderIcon size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                  Drop files here or click to browse
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Support for CSV, OFX, and QIF files
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 cursor-pointer">
                  <UploadIcon size={20} />
                  Select Files
                  <input
                    type="file"
                    multiple
                    accept=".csv,.ofx,.qif"
                    onChange={handleFileSelection}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <>
                {/* File List */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </h3>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer">
                      <UploadIcon size={16} />
                      Add More
                      <input
                        type="file"
                        multiple
                        accept=".csv,.ofx,.qif"
                        onChange={handleFileSelection}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          file.status === 'error'
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : file.status === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : file.status === 'processing'
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="text-2xl">{getFileIcon(file.type)}</div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {file.name}
                            </p>
                            {getStatusIcon(file.status)}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {file.size} • {file.type.toUpperCase()}
                            {file.status === 'success' && file.imported !== undefined && (
                              <span className="ml-2 text-green-600">
                                {file.imported} imported, {file.duplicates} duplicates
                              </span>
                            )}
                            {file.status === 'error' && file.error && (
                              <span className="ml-2 text-red-600">{file.error}</span>
                            )}
                            {file.accountMatched && (
                              <span className="ml-2 text-primary">
                                → {accounts.find(a => a.id === file.accountMatched)?.name}
                              </span>
                            )}
                          </p>
                        </div>

                        {file.status === 'pending' && !isProcessing && (
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <XIcon size={20} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress Bar */}
                {isProcessing && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        Processing file {currentFileIndex + 1} of {files.length}
                      </span>
                      <span className="text-primary">
                        {formatPercentageValue(
                          toDecimal(currentFileIndex + 1)
                            .dividedBy(files.length)
                            .times(100),
                          0
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${toDecimal(currentFileIndex + 1)
                            .dividedBy(files.length)
                            .times(100)
                            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                            .toNumber()}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={onClose}
                    disabled={isProcessing}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    onClick={startBatchImport}
                    disabled={files.length === 0}
                    isLoading={isProcessing}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <StopIcon size={20} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <PlayIcon size={20} />
                        Import All Files
                      </>
                    )}
                  </LoadingButton>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
