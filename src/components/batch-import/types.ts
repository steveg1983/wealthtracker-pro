export interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FileInfo {
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

export interface ImportSummary {
  totalFiles: number;
  successfulFiles: number;
  totalTransactions: number;
  totalDuplicates: number;
}

export const FILE_ICONS = {
  csv: '📊',
  ofx: '🏦',
  qif: '💰',
  unknown: '📄'
} as const;