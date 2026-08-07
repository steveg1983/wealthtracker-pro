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
import { isDuplicateImport } from '../utils/importDedupe';

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
  const { accounts, transactions, addTransaction } = useApp();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [importSummary, setImportSummary] = useState<{
    totalFiles: number;
    successfulFiles: number;
    totalTransactions: number;
    totalDuplicates: number;
  } | null>(null);

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
    
    // Filter out unknown file types
    const validFiles = fileInfos.filter(f => f.type !== 'unknown');
    const invalidFiles = fileInfos.filter(f => f.type === 'unknown');
    
    if (invalidFiles.length > 0) {
      alert(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}`);
    }
    
    setFiles(validFiles);
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

  const processFile = async (fileInfo: FileInfo, index: number): Promise<void> => {
    setCurrentFileIndex(index);
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, status: 'processing' } : f
    ));

    try {
      const content = await fileInfo.file.text();
      let imported = 0;
      let duplicates = 0;
      let accountMatched = '';

      switch (fileInfo.type) {
        case 'csv': {
          const parsed = enhancedCsvImportService.parseCSV(content);
          const mappings = enhancedCsvImportService.suggestMappings(parsed.headers, 'transaction');
          const preview = enhancedCsvImportService.generatePreview(parsed.data, mappings);
          
          // Try to match account from transactions
          const possibleAccounts = new Set<string>();
          preview.transactions.forEach((t) => {
            if (t.accountId) possibleAccounts.add(t.accountId);
          });
          
          if (possibleAccounts.size === 1) {
            accountMatched = Array.from(possibleAccounts)[0];
          } else if (possibleAccounts.size === 0 && accounts.length > 0) {
            // Default to first account if no match found
            accountMatched = accounts[0].id;
          }
          
          // Import transactions
          for (const transaction of preview.transactions) {
            // Dates are compared as instants: `===` on two Date objects is
            // identity, so this test never once matched and every re-import
            // duplicated the statement.
            const isDuplicate = isDuplicateImport(transactions, transaction);

            if (!isDuplicate && transaction.date && transaction.amount !== undefined && transaction.description && transaction.category && transaction.type) {
              await addTransaction({
                date: transaction.date,
                amount: transaction.amount,
                description: transaction.description,
                category: transaction.category,
                type: transaction.type,
                accountId: transaction.accountId || accountMatched,
                tags: transaction.tags,
                notes: transaction.notes
              });
              imported++;
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
            {}
          );
          accountMatched = result.matchedAccount?.id || accounts[0]?.id || '';
          
          for (const transaction of result.transactions) {
            await addTransaction(transaction);
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
            {}
          );
          accountMatched = accounts[0]?.id || '';
          
          for (const transaction of result.transactions) {
            await addTransaction(transaction);
            imported++;
          }
          duplicates = result.duplicates;
          break;
        }
      }

      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: 'success', 
          imported, 
          duplicates,
          accountMatched 
        } : f
      ));
    } catch (error) {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Import failed' 
        } : f
      ));
    }
  };

  // Retired 2026-08-07: the "Clear Test Data?" gate that used to stand in front
  // of this. It read a flag nothing could keep true, and clearing called a
  // context reset that only emptied React state — on a cloud login the rows it
  // claimed to remove were back on the next load. This import only ever adds,
  // and the file list says so; see the note above the Start button.
  const startBatchImport = async () => {
    setIsProcessing(true);
    setImportSummary(null);

    let totalImported = 0;
    let totalDuplicates = 0;
    let successfulFiles = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await processFile(files[i], i);
        
        const updatedFile = files[i];
        if (updatedFile.status === 'success') {
          successfulFiles++;
          totalImported += updatedFile.imported || 0;
          totalDuplicates += updatedFile.duplicates || 0;
        }
      }
    }

    setImportSummary({
      totalFiles: files.length,
      successfulFiles,
      totalTransactions: totalImported,
      totalDuplicates
    });
    
    setIsProcessing(false);
    setCurrentFileIndex(-1);
  };

  const reset = () => {
    setFiles([]);
    setImportSummary(null);
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
      case 'success': return <CheckIcon size={16} className="text-blue-600" />;
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
        {importSummary ? (
          <div className="text-center">
            <CheckIcon size={48} className="mx-auto text-blue-600 mb-4" />
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
                  <p className="text-2xl font-bold text-blue-600">
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
                    {Math.round((importSummary.successfulFiles / importSummary.totalFiles) * 100)}%
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
                className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-primary/90"
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
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-primary/90 cursor-pointer">
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
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
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
                              <span className="ml-2 text-blue-600">
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
                        {Math.round(((currentFileIndex + 1) / files.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentFileIndex + 1) / files.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* What the import will actually do, stated before it runs.
                    Every path here only ADDS: no existing transaction is
                    changed or removed, and rows matching one already loaded are
                    skipped and counted as duplicates. */}
                {!isProcessing && (
                  <div className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
                    <AlertCircleIcon size={18} className="mt-0.5 flex-shrink-0" />
                    <p>
                      These transactions are added to your existing data — nothing is
                      replaced or deleted. Anything matching a transaction you already
                      have is skipped and counted as a duplicate.
                    </p>
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
                    className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
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
