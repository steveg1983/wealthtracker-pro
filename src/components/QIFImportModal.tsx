import React, { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { qifImportService } from '../services/qifImportService';
import { Modal } from './common/Modal';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  AlertCircleIcon,
  InfoIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';

interface QIFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QIFImportModal({ isOpen, onClose }: QIFImportModalProps) {
  const { accounts, transactions, categories, addTransaction } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    
    // Check file extension
    if (!uploadedFile.name.toLowerCase().endsWith('.qif')) {
      alert('Please select a QIF file');
      return;
    }
    
    setFile(uploadedFile);
    setParseResult(null);
    setImportResult(null);
    
    // Parse the file
    parseFile(uploadedFile);
  }, []);
  
  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.qif')) {
      setFile(droppedFile);
      setParseResult(null);
      setImportResult(null);
      parseFile(droppedFile);
    }
  }, []);
  
  // Parse QIF file
  const parseFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const parsed = qifImportService.parseQIF(content);
      
      setParseResult({
        transactions: parsed.transactions,
        accountType: parsed.accountType
      });
      
      // Pre-select first account if only one exists
      if (accounts.length === 1) {
        setSelectedAccountId(accounts[0].id);
      }
    } catch (error) {
      console.error('Error parsing QIF file:', error);
      alert('Error parsing QIF file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Process import
  const processImport = async () => {
    if (!parseResult || !file || !selectedAccountId) return;
    
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const result = await qifImportService.importTransactions(
        content,
        selectedAccountId,
        skipDuplicates ? transactions : [],
        {
          categories,
          autoCategorize: true
        }
      );
      
      // Add transactions
      for (const transaction of result.transactions) {
        addTransaction({
          ...transaction,
          id: `qif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
      
      setImportResult({
        success: true,
        imported: result.newTransactions,
        duplicates: result.duplicates,
        account: accounts.find(a => a.id === selectedAccountId)
      });
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Reset modal
  const resetModal = () => {
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    setSelectedAccountId('');
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import QIF File" size="lg">
      <div className="p-6">
        {!parseResult && !importResult && (
          <>
            {/* File Upload */}
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Upload QIF File
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop your .qif file here, or click to browse
              </p>
              <input
                type="file"
                accept=".qif"
                onChange={handleFileUpload}
                className="hidden"
                id="qif-upload"
              />
              <label
                htmlFor="qif-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary cursor-pointer"
              >
                <FileTextIcon size={20} />
                Select QIF File
              </label>
            </div>
            
            {/* Info Box */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InfoIcon className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                <div className="text-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    About QIF Files
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200 mb-2">
                    QIF (Quicken Interchange Format) is a simple text format for financial data.
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Widely supported by UK banks and financial software</li>
                    <li>• Simple format but no unique transaction IDs</li>
                    <li>• Requires manual account selection</li>
                    <li>• Best for one-time imports or initial setup</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Parse Results */}
        {parseResult && !importResult && (
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <FileTextIcon className="text-gray-600 dark:text-gray-400" size={24} />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{file?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {parseResult.transactions.length} transactions found
                  {parseResult.accountType && ` (Type: ${parseResult.accountType})`}
                </p>
              </div>
            </div>
            
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import to Account <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select an account...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                QIF files don't contain account information, so you need to select the destination account
              </p>
            </div>
            
            {/* Import Options */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Skip potential duplicates
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                Checks for transactions with the same date, amount, and payee
              </p>
            </div>
            
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Preview (First 5 transactions)
              </h4>
              <div className="space-y-2 text-sm">
                {parseResult.transactions.slice(0, 5).map((trx: any, index: number) => (
                  <div key={index} className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{trx.date} - {trx.payee || trx.memo || 'No description'}</span>
                    <span className={trx.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                      £{Math.abs(trx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
                {parseResult.transactions.length > 5 && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                    ...and {parseResult.transactions.length - 5} more transactions
                  </p>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <LoadingButton
                isLoading={isProcessing}
                onClick={processImport}
                disabled={!selectedAccountId}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50"
              >
                <UploadIcon size={20} />
                Import Transactions
              </LoadingButton>
            </div>
          </div>
        )}
        
        {/* Import Results */}
        {importResult && (
          <div className="text-center">
            {importResult.success ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <CheckIcon size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Successful!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Imported {importResult.imported} transactions to {importResult.account?.name}
                </p>
                
                {importResult.duplicates > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
                    Skipped {importResult.duplicates} potential duplicate transactions
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                  <AlertCircleIcon size={32} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Failed
                </h3>
                <p className="text-red-600 dark:text-red-400 mb-6">
                  {importResult.error}
                </p>
              </>
            )}
            
            <div className="flex justify-center gap-3">
              <button
                onClick={resetModal}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <RefreshCwIcon size={20} />
                Import Another File
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}