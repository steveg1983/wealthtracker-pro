import React, { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { ofxImportService } from '../services/ofxImportService';
import { Modal } from './common/Modal';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  AlertCircleIcon,
  InfoIcon,
  LinkIcon,
  UnlinkIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';

interface OFXImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OFXImportModal({ isOpen, onClose }: OFXImportModalProps) {
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
    if (!uploadedFile.name.toLowerCase().endsWith('.ofx')) {
      alert('Please select an OFX file');
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
    
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.ofx')) {
      setFile(droppedFile);
      setParseResult(null);
      setImportResult(null);
      parseFile(droppedFile);
    }
  }, []);
  
  // Parse OFX file
  const parseFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const result = await ofxImportService.importTransactions(
        content,
        accounts,
        transactions,
        { 
          skipDuplicates: false,
          categories,
          autoCategorize: true
        }
      );
      
      setParseResult(result);
      
      // Auto-select account if matched
      if (result.matchedAccount) {
        setSelectedAccountId(result.matchedAccount.id);
      }
    } catch (error) {
      console.error('Error parsing OFX file:', error);
      alert('Error parsing OFX file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Process import
  const processImport = async () => {
    if (!parseResult || !file) return;
    
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const result = await ofxImportService.importTransactions(
        content,
        accounts,
        transactions,
        {
          accountId: selectedAccountId || undefined,
          skipDuplicates,
          categories,
          autoCategorize: true
        }
      );
      
      // Add transactions
      for (const transaction of result.transactions) {
        addTransaction({
          ...transaction,
          id: `ofx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
      
      setImportResult({
        success: true,
        imported: result.newTransactions,
        duplicates: result.duplicates,
        account: result.matchedAccount || accounts.find(a => a.id === selectedAccountId)
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
    <Modal isOpen={isOpen} onClose={onClose} title="Import OFX File" size="lg">
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
                Upload OFX File
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop your .ofx file here, or click to browse
              </p>
              <input
                type="file"
                accept=".ofx"
                onChange={handleFileUpload}
                className="hidden"
                id="ofx-upload"
              />
              <label
                htmlFor="ofx-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary cursor-pointer"
              >
                <FileTextIcon size={20} />
                Select OFX File
              </label>
            </div>
            
            {/* Info Box */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InfoIcon className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                <div className="text-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    About OFX Files
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200 mb-2">
                    OFX (Open Financial Exchange) files contain standardized financial data exported from banks and credit card companies.
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Automatic duplicate detection using transaction IDs</li>
                    <li>• Smart account matching based on account numbers</li>
                    <li>• Preserves transaction reference numbers</li>
                    <li>• Imports cleared transactions with exact dates</li>
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
                </p>
              </div>
            </div>
            
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import to Account
              </label>
              
              {parseResult.matchedAccount ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <LinkIcon className="text-green-600 dark:text-green-400 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-300">
                        Automatically matched to: {parseResult.matchedAccount.name}
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                        Based on account number ending in {parseResult.unmatchedAccount?.accountId.slice(-4)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {parseResult.unmatchedAccount && (
                    <div className="p-4 mb-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <UnlinkIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                        <div>
                          <p className="font-medium text-yellow-900 dark:text-yellow-300">
                            No matching account found
                          </p>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                            OFX Account: ****{parseResult.unmatchedAccount.accountId.slice(-4)}
                            {parseResult.unmatchedAccount.bankId && ` (Sort code: ${parseResult.unmatchedAccount.bankId.slice(-6)})`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
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
                </>
              )}
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
                  Skip duplicate transactions
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                Uses unique transaction IDs to prevent importing the same transaction twice
              </p>
            </div>
            
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {parseResult.transactions.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {parseResult.duplicates || 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates Found</p>
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
                disabled={!selectedAccountId && !parseResult.matchedAccount}
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
                    Skipped {importResult.duplicates} duplicate transactions
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