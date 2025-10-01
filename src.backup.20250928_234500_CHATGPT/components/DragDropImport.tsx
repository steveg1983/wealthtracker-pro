import React, { useState, useCallback, useRef } from 'react';
import {
  UploadIcon,
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  FileTextIcon,
  DownloadIcon,
  StarIcon
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
// import { importService } from '../services/importService';
import type { Transaction } from '../types';

interface DragDropImportProps {
  onImportComplete?: (transactions: Transaction[]) => void;
  compact?: boolean;
}

interface ImportProgress {
  status: 'idle' | 'detecting' | 'parsing' | 'previewing' | 'importing' | 'complete' | 'error';
  progress: number;
  message: string;
  fileName?: string;
  fileSize?: number;
  format?: 'csv' | 'qif' | 'ofx' | 'unknown';
  rowCount?: number;
  successCount?: number;
  errorCount?: number;
  errors?: string[];
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  mappings: {
    date?: number;
    description?: number;
    amount?: number;
    category?: number;
    account?: number;
  };
}

/**
 * Drag and Drop Import Component
 * Design principles:
 * 1. Drop files anywhere on the page
 * 2. Visual drop zones with hover effects
 * 3. Automatic format detection
 * 4. Import progress visualization
 * 5. Preview and mapping before import
 */
export function DragDropImport({ 
  onImportComplete,
  compact = false 
}: DragDropImportProps): React.JSX.Element {
  const { addTransaction, accounts, categories } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle',
    progress: 0,
    message: 'Drop a file to import transactions'
  });
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Detect file format based on extension and content
  const detectFormat = async (file: File): Promise<'csv' | 'qif' | 'ofx' | 'unknown'> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Check by extension first
    if (extension === 'csv') return 'csv';
    if (extension === 'qif') return 'qif';
    if (extension === 'ofx' || extension === 'qfx') return 'ofx';
    
    // Check by content
    const text = await file.text();
    const [firstLine = ''] = text.split('\n');
    
    if (firstLine.includes(',') || firstLine.includes('\t')) return 'csv';
    if (firstLine.startsWith('!Type:')) return 'qif';
    if (text.includes('<OFX>') || text.includes('OFXHEADER')) return 'ofx';
    
    return 'unknown';
  };

  // Parse CSV for preview
  const parseCSVPreview = (text: string): PreviewData => {
    const lines = text.split('\n').filter(line => line.trim());
    const [headerLine = ''] = lines;
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1, 6).map(line =>
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );
    
    // Auto-detect column mappings
    const mappings: PreviewData['mappings'] = {};
    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      if (h.includes('date')) mappings.date = index;
      else if (h.includes('description') || h.includes('merchant') || h.includes('payee')) mappings.description = index;
      else if (h.includes('amount') || h.includes('debit') || h.includes('credit')) mappings.amount = index;
      else if (h.includes('category')) mappings.category = index;
      else if (h.includes('account')) mappings.account = index;
    });
    
    return { headers, rows, mappings };
  };

  // Process file
  const processFile = async (file: File) => {
    setImportProgress({
      status: 'detecting',
      progress: 10,
      message: 'Detecting file format...',
      fileName: file.name,
      fileSize: file.size
    });

    try {
      // Detect format
      const format = await detectFormat(file);
      
      setImportProgress(prev => ({
        ...prev,
        status: 'parsing',
        progress: 30,
        message: `Detected ${format.toUpperCase()} format. Parsing file...`,
        format
      }));

      const text = await file.text();
      
      if (format === 'csv') {
        // Parse CSV for preview
        const preview = parseCSVPreview(text);
        setPreviewData(preview);
        setShowMapping(true);
        
        setImportProgress(prev => ({
          ...prev,
          status: 'previewing',
          progress: 50,
          message: `Found ${preview.rows.length} transactions. Review mapping...`,
          rowCount: preview.rows.length
        }));
      } else if (format === 'qif' || format === 'ofx') {
        throw new Error(`${format.toUpperCase()} import is not supported yet. Please convert the file to CSV.`);
      } else if (format === 'unknown') {
        throw new Error('Unsupported file format. Please use CSV files.');
      }
    } catch (error) {
      setImportProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Import failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    }
  };

  // Import transactions
  const importTransactions = async (transactions: Partial<Transaction>[]) => {
    setImportProgress(prev => ({
      ...prev,
      status: 'importing',
      progress: 70,
      message: `Importing ${transactions.length} transactions...`
    }));

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        const transaction = transactions[i];
        if (!transaction) {
          throw new Error('Invalid transaction data');
        }
        
        // Add default values
        const amount = typeof transaction.amount === 'number'
          ? transaction.amount
          : Number(transaction.amount ?? 0);

        const resolvedAccountId = transaction.accountId ?? accounts[0]?.id;
        if (!resolvedAccountId) {
          throw new Error('No account available for import');
        }

        const resolvedDate = transaction.date instanceof Date
          ? transaction.date
          : new Date(transaction.date ?? Date.now());

        const newTransaction: Omit<Transaction, 'id'> = {
          date: resolvedDate,
          amount,
          description: transaction.description ?? 'Imported transaction',
          category: transaction.category ?? '',
          accountId: resolvedAccountId,
          type: transaction.type ?? (amount >= 0 ? 'income' : 'expense'),
          cleared: false
        };
        
        if (transaction.notes) {
          newTransaction.notes = transaction.notes;
        }
        if (transaction.tags) {
          newTransaction.tags = transaction.tags;
        }

        await addTransaction(newTransaction);
        successCount++;
        
        // Update progress
        const progress = 70 + (30 * (i + 1) / transactions.length);
        setImportProgress(prev => ({
          ...prev,
          progress,
          successCount,
          message: `Imported ${successCount} of ${transactions.length} transactions...`
        }));
      } catch (error) {
        errorCount++;
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Import failed'}`);
      }
    }

    setImportProgress({
      status: 'complete',
      progress: 100,
      message: `Import complete! ${successCount} transactions imported.`,
      successCount,
      errorCount,
      ...(errors.length > 0 ? { errors } : {})
    });

    if (onImportComplete) {
      onImportComplete([]);
    }
  };

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const [firstFile] = files;
    if (firstFile) {
      await processFile(firstFile);
    }
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const firstFile = files ? files[0] : undefined;
    if (firstFile) {
      await processFile(firstFile);
    }
  }, []);

  // Import from preview
  const importFromPreview = useCallback(async () => {
    if (!previewData) return;
    
    const transactions: Partial<Transaction>[] = previewData.rows.map(row => {
      const rawDate = previewData.mappings.date !== undefined ? row[previewData.mappings.date] : undefined;
      const parsedDate = rawDate ? new Date(rawDate) : new Date();

      const rawAmount = previewData.mappings.amount !== undefined ? row[previewData.mappings.amount] : undefined;
      const amount = rawAmount ? Number(rawAmount) : 0;

      const descriptionValue = previewData.mappings.description !== undefined ? row[previewData.mappings.description] : undefined;
      const description = descriptionValue && descriptionValue.trim().length > 0 ? descriptionValue : 'Imported';

      const categoryValue = previewData.mappings.category !== undefined ? row[previewData.mappings.category] : undefined;
      const category = categoryValue ?? '';

      const accountFromRow = previewData.mappings.account !== undefined ? row[previewData.mappings.account] : undefined;
      const resolvedAccountId = accountFromRow ?? accounts[0]?.id;

      const transaction: Partial<Transaction> = {
        date: parsedDate,
        description,
        amount,
        type: amount >= 0 ? 'income' : 'expense',
        category,
        cleared: false
      };

      if (resolvedAccountId) {
        transaction.accountId = resolvedAccountId;
      }

      return transaction;
    });
    
    await importTransactions(transactions);
    setShowMapping(false);
    setPreviewData(null);
  }, [previewData, accounts]);

  // Reset import
  const resetImport = useCallback(() => {
    setImportProgress({
      status: 'idle',
      progress: 0,
      message: 'Drop a file to import transactions'
    });
    setPreviewData(null);
    setShowMapping(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getStatusIcon = () => {
    switch (importProgress.status) {
      case 'complete':
        return <CheckCircleIcon size={48} className="text-green-500" />;
      case 'error':
        return <XCircleIcon size={48} className="text-red-500" />;
      case 'detecting':
      case 'parsing':
      case 'importing':
        return <RefreshCwIcon size={48} className="text-gray-500 animate-spin" />;
      default:
        return <UploadIcon size={48} className="text-gray-400" />;
    }
  };

  if (compact) {
    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.qif,.ofx,.qfx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
        >
          <UploadIcon size={20} />
          Import File
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
          ${isDragging 
            ? 'border-primary bg-primary/10 scale-105 shadow-lg' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${importProgress.status === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          ${importProgress.status === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.qif,.ofx,.qfx"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center">
          {getStatusIcon()}
          
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            {isDragging ? 'Drop file here' : importProgress.message}
          </h3>
          
          {importProgress.status === 'idle' && (
            <>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Drag and drop a CSV, QIF, or OFX file here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:text-secondary font-medium"
                >
                  browse your files
                </button>
              </p>
              <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <FileTextIcon size={16} />
                  CSV
                </div>
                <div className="flex items-center gap-1">
                  <FolderIcon size={16} />
                  QIF
                </div>
                <div className="flex items-center gap-1">
                  <FolderIcon size={16} />
                  OFX/QFX
                </div>
              </div>
            </>
          )}
          
          {/* Progress Bar */}
          {importProgress.status !== 'idle' && importProgress.status !== 'previewing' && (
            <div className="w-full max-w-md mt-6">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out rounded-full ${
                    importProgress.status === 'error' ? 'bg-red-500' :
                    importProgress.status === 'complete' ? 'bg-green-500' :
                    'bg-gray-500'
                  }`}
                  style={{ width: `${importProgress.progress}%` }}
                />
              </div>
              
              {/* Statistics */}
              {importProgress.status === 'complete' && (
                <div className="mt-4 flex justify-center gap-6 text-sm">
                  <div className="text-green-600 dark:text-green-400">
                    <CheckCircleIcon size={16} className="inline mr-1" />
                    {importProgress.successCount} imported
                  </div>
                  {importProgress.errorCount! > 0 && (
                    <div className="text-red-600 dark:text-red-400">
                      <XCircleIcon size={16} className="inline mr-1" />
                      {importProgress.errorCount} failed
                    </div>
                  )}
                </div>
              )}
              
              {/* Error Messages */}
              {importProgress.errors && importProgress.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-left">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Import Errors:
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    {importProgress.errors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {importProgress.errors.length > 5 && (
                      <li>• ...and {importProgress.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Action Buttons */}
              {(importProgress.status === 'complete' || importProgress.status === 'error') && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={resetImport}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Import Another File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Visual Drop Indicator */}
        {isDragging && (
          <div className="absolute inset-0 rounded-xl bg-primary/20 flex items-center justify-center pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
              <DownloadIcon size={32} className="text-primary mx-auto mb-2 animate-bounce" />
              <p className="text-primary font-semibold">Release to import</p>
            </div>
          </div>
        )}
      </div>

      {/* Preview and Mapping Modal */}
      {showMapping && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preview Import - {previewData.rows.length} Transactions
              </h3>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {/* Column Mapping */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <StarIcon size={20} className="text-gray-600 dark:text-gray-500" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Auto-detected Column Mappings
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(previewData.mappings).map(([field, index]) => (
                    <div key={field} className="flex items-center gap-2">
                      <CheckCircleIcon size={16} className="text-green-500" />
                      <span className="text-sm capitalize">{field}:</span>
                      <span className="text-sm font-medium">
                        {previewData.headers[index!]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Preview Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 dark:bg-gray-900">
                      {previewData.headers.map((header, idx) => (
                        <th key={idx} className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white">
                          {header}
                          {Object.entries(previewData.mappings).find(([_, index]) => index === idx) && (
                            <span className="ml-1 text-xs text-primary">
                              ✓
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-t border-gray-200 dark:border-gray-700">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => {
                  setShowMapping(false);
                  resetImport();
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={importFromPreview}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <CheckCircleIcon size={20} />
                Import {previewData.rows.length} Transactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
