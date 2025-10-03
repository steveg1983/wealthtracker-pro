import type { Transaction, Account, Category } from '../../types';
import type { JsonValue } from '../../types/common';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: string) => JsonValue;
}

export interface ImportProfile {
  id: string;
  name: string;
  type: 'transaction' | 'account';
  mappings: ColumnMapping[];
  dateFormat?: string;
  bank?: string;
  lastUsed?: Date;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number; // 0-100
  matches: Array<{
    id: string;
    field: string;
    similarity: number;
  }>;
}

export interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  items: Array<Partial<Transaction> | Partial<Account>>;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export interface ParsedCsvData {
  headers: string[];
  data: string[][];
}

export interface ValidationOptions {
  checkDuplicates?: boolean;
  validateDates?: boolean;
  validateAmounts?: boolean;
  applyRules?: boolean;
  smartCategorization?: boolean;
}

export interface BankFormat {
  name: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  dateFormat: string;
  hasHeaders: boolean;
  delimiter: ',' | ';' | '\t';
  encoding?: string;
}

export interface ImportStatistics {
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  duplicatesSkipped: number;
  categorized: number;
  rulesApplied: number;
  averageConfidence: number;
  processingTimeMs: number;
}