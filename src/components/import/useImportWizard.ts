import { useState, useCallback } from 'react';
import { enhancedCsvImportService, type ColumnMapping } from '../../services/enhancedCsvImportService';
import { importRulesService } from '../../services/importRulesService';
import { ofxImportService } from '../../services/ofxImportService';
import { qifImportService } from '../../services/qifImportService';
import { logger } from '../../services/loggingService';
import type { FileInfo } from './FileUploadStep';
import type { Transaction } from '../../types';

export type WizardStep = 'files' | 'format' | 'mapping' | 'rules' | 'preview' | 'result';
export type ImportFile = FileInfo; // Alias for backward compatibility

export function useImportWizard(
  accounts: any[],
  transactions: Transaction[],
  categories: any[],
  addTransaction: (transaction: any) => void
) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('files');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedBankFormat, setSelectedBankFormat] = useState<string>('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);

  const addFiles = useCallback((newFiles: FileInfo[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleBankFormatSelected = useCallback((bankKey: string) => {
    setSelectedBankFormat(bankKey);
    
    if (bankKey !== 'custom') {
      const bankMappings = enhancedCsvImportService.getBankMappings(bankKey);
      setMappings(bankMappings);
    }
  }, []);

  const processFiles = useCallback(async () => {
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
          index === i ? { ...f, status: 'processing' as const } : f
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
                
                if (!isDuplicate && transaction.date && transaction.amount !== undefined && 
                    transaction.type && transaction.category && transaction.accountId && 
                    transaction.description !== undefined) {
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
              status: 'success' as const,
              imported,
              duplicates
            } : f
          ));
          
          totalImported += imported;
          totalDuplicates += duplicates;
          successfulFiles++;
        } catch (error) {
          logger.error('Error processing file:', error);
          setFiles(prev => prev.map((f, index) => 
            index === i ? { 
              ...f, 
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Unknown error'
            } : f
          ));
        }
      }
      
      setImportResult({
        totalImported,
        totalDuplicates,
        successfulFiles,
        totalFiles: files.length
      });
    } finally {
      setIsProcessing(false);
      setCurrentFileIndex(-1);
    }
  }, [files, selectedBankFormat, mappings, transactions, accounts, categories, addTransaction]);

  const reset = useCallback(() => {
    setCurrentStep('files');
    setFiles([]);
    setSelectedBankFormat('');
    setMappings([]);
    setIsProcessing(false);
    setImportResult(null);
    setCurrentFileIndex(-1);
  }, []);

  return {
    // State
    currentStep,
    files,
    selectedBankFormat,
    mappings,
    isProcessing,
    importResult,
    currentFileIndex,
    
    // Actions
    setCurrentStep,
    addFiles,
    removeFile,
    handleBankFormatSelected,
    setMappings,
    processFiles,
    reset
  };
}
