import { useState, useCallback } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { enhancedCsvImportService } from '../../services/enhancedCsvImportService';
import { ofxImportService } from '../../services/ofxImportService';
import { qifImportService } from '../../services/qifImportService';
import type { FileInfo, ImportSummary } from './types';
import type { Transaction } from '../../types';

export function useBatchImport(onClose: () => void) {
  const { accounts, transactions, addTransaction } = useApp();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

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
    
    setFiles(validFiles);
  }, []);

  const processFile = async (fileInfo: FileInfo, index: number) => {
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
          const importRes = await enhancedCsvImportService.importCsv(
            content,
            [],
            'transaction'
          );
          accountMatched = 'CSV Import';
          for (const item of importRes.items as Partial<Transaction>[]) {
            if (!item || item.amount === undefined || !item.date) continue;
            const amountNum = Number(item.amount);
            const dateVal = typeof item.date === 'string' ? new Date(item.date) : (item.date as Date);
            const newTx: Omit<Transaction, 'id'> = {
              date: dateVal,
              description: String(item.description || 'Imported transaction'),
              amount: Math.abs(amountNum),
              type: amountNum < 0 ? 'expense' : 'income',
              accountId: (item as any).accountId || accounts[0]?.id || 'default',
              category: (item as any).category || ''
            };
            // Simple duplicate check by date, amount, description
            const isDuplicate = transactions.some(t => {
              const existingDate = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
              const incomingDate = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(item.date);
              return existingDate === incomingDate && t.amount === newTx.amount && t.description === newTx.description;
            });
            if (!isDuplicate) {
              await addTransaction(newTx);
              imported++;
            } else {
              duplicates++;
            }
          }
          break;
        }
        case 'ofx': {
          const result = ofxImportService.parseOFX(content);
          accountMatched = result.account.accountId || 'Unknown Account';
          for (const trx of result.transactions) {
            const dateStr = trx.datePosted;
            const amountNum = Math.abs(trx.amount);
            const type = trx.amount < 0 ? 'expense' : 'income';
            const description = trx.name + (trx.memo ? ` - ${trx.memo}` : '');
            const newTx: Omit<Transaction, 'id'> = {
              date: new Date(dateStr),
              description: description || 'OFX Transaction',
              amount: amountNum,
              type,
              accountId: accounts[0]?.id || 'default',
              category: ''
            };
            const isDuplicate = transactions.some(t => {
              const existingDate = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
              return existingDate === dateStr && t.amount === newTx.amount && t.description === newTx.description;
            });
            if (!isDuplicate) {
              await addTransaction(newTx);
              imported++;
            } else {
              duplicates++;
            }
          }
          break;
        }
        case 'qif': {
          accountMatched = accounts[0]?.name || 'Default Account';
          const res = await qifImportService.importTransactions(
            content,
            accounts[0]?.id || 'default',
            transactions,
            {}
          );
          for (const newTx of res.transactions) {
            const isDuplicate = transactions.some(t => {
              const existingDate = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
              const incomingDate = typeof newTx.date === 'string' ? newTx.date : (newTx.date as Date).toISOString().split('T')[0];
              return existingDate === incomingDate && t.amount === newTx.amount && t.description === newTx.description;
            });
            if (!isDuplicate) {
              await addTransaction(newTx);
              imported++;
            } else {
              duplicates++;
            }
          }
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
    setShowTestDataWarning(false);
  };

  return {
    files,
    isProcessing,
    currentFileIndex,
    showTestDataWarning,
    setShowTestDataWarning,
    importSummary,
    handleFileSelection,
    handleDrop,
    startBatchImport,
    reset
  };
}
