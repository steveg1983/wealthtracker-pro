/**
 * Custom Hook for OFX Import
 * Manages OFX file import state and operations
 */

import { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { ofxImportModalService } from '../services/ofxImportModalService';
import type { ParseResult, ImportResult } from '../services/ofxImportModalService';

export interface UseOFXImportReturn {
  file: File | null;
  isProcessing: boolean;
  parseResult: ParseResult | null;
  importResult: ImportResult | null;
  selectedAccountId: string;
  skipDuplicates: boolean;
  duplicateCount: number;
  dateRange: { start: Date | null; end: Date | null };
  setSelectedAccountId: (id: string) => void;
  setSkipDuplicates: (skip: boolean) => void;
  handleFileSelect: (file: File) => void;
  handleImport: () => Promise<void>;
  reset: () => void;
}

export function useOFXImport(onClose: () => void): UseOFXImportReturn {
  const { accounts, transactions, categories, addTransaction } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Calculate derived values
  const duplicateCount = parseResult 
    ? ofxImportModalService.calculateDuplicates(parseResult.transactions)
    : 0;
  
  const dateRange = parseResult
    ? ofxImportModalService.getDateRange(parseResult.transactions)
    : { start: null, end: null };

  // Handle file selection and parsing
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!ofxImportModalService.isValidOFXFile(selectedFile.name)) {
      throw new Error('Please select a valid OFX file');
    }

    setFile(selectedFile);
    setParseResult(null);
    setImportResult(null);
    setIsProcessing(true);

    try {
      const result = await ofxImportModalService.parseOFXFile(
        selectedFile,
        accounts,
        transactions,
        categories
      );
      
      setParseResult(result);
      
      // Auto-select account if matched
      if (result.matchedAccount) {
        setSelectedAccountId(result.matchedAccount.id);
      }
    } catch (error) {
      console.error('Error parsing OFX file:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [accounts, transactions, categories]);

  // Handle import process
  const handleImport = useCallback(async () => {
    if (!parseResult || !ofxImportModalService.isValidAccountSelection(selectedAccountId, parseResult)) {
      return;
    }

    setIsProcessing(true);

    try {
      const result = await ofxImportModalService.processImport(
        file!,
        parseResult,
        accounts,
        transactions,
        { 
          accountId: selectedAccountId, 
          skipDuplicates,
          categories: [],
          autoCategorize: false
        },
        addTransaction
      );
      
      setImportResult(result);
      
      // Close modal after successful import
      if (result.imported && result.imported > 0) {
        setTimeout(() => {
          onClose();
          reset();
        }, 2000);
      }
    } catch (error) {
      console.error('Error importing transactions:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [parseResult, selectedAccountId, skipDuplicates, addTransaction, onClose]);

  // Reset state
  const reset = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    setSelectedAccountId('');
    setSkipDuplicates(true);
    setIsProcessing(false);
  }, []);

  return {
    file,
    isProcessing,
    parseResult,
    importResult,
    selectedAccountId,
    skipDuplicates,
    duplicateCount,
    dateRange,
    setSelectedAccountId,
    setSkipDuplicates,
    handleFileSelect,
    handleImport,
    reset
  };
}