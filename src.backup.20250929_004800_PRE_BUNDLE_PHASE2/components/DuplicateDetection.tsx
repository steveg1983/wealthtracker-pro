import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Modal } from './common/Modal';
import { 
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  TrashIcon,
  MergeIcon,
  CalendarIcon,
  DollarSignIcon,
  FileTextIcon,
  FilterIcon
} from './icons';
import type { Transaction } from '../types';
import { toDecimal } from '../utils/decimal';

interface DuplicateDetectionProps {
  isOpen: boolean;
  onClose: () => void;
  newTransactions?: Partial<Transaction>[];
  onConfirm?: (transactions: Partial<Transaction>[]) => void;
}

interface DuplicateGroup {
  original: Transaction;
  potential: Transaction[];
  confidence: number;
}

interface SimilarityScore {
  dateScore: number;
  amountScore: number;
  descriptionScore: number;
  totalScore: number;
}

export default function DuplicateDetection({ 
  isOpen, 
  onClose, 
  newTransactions,
  onConfirm 
}: DuplicateDetectionProps) {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dateThreshold, setDateThreshold] = useState(3); // days
  const [amountThreshold, setAmountThreshold] = useState(0.01); // currency units
  const [similarityThreshold, setSimilarityThreshold] = useState(80); // percentage
  const [autoSelectHighConfidence, setAutoSelectHighConfidence] = useState(true);

  // Calculate string similarity using Levenshtein distance
  const calculateStringSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 100;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = Array.from({ length: len2 + 1 }, (_, rowIndex) => {
      const row = new Array<number>(len1 + 1);
      row[0] = rowIndex;
      return row;
    });

    for (let j = 0; j <= len1; j += 1) {
      const firstRow = matrix[0];
      if (firstRow) {
        firstRow[j] = j;
      }
    }

    for (let i = 1; i <= len2; i += 1) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!currentRow || !prevRow) {
        continue;
      }

      for (let j = 1; j <= len1; j += 1) {
        const left = currentRow[j - 1];
        const up = prevRow[j];
        const diag = prevRow[j - 1];

        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          currentRow[j] = diag ?? 0;
        } else {
          const insertion = (left ?? Number.POSITIVE_INFINITY) + 1;
          const deletion = (up ?? Number.POSITIVE_INFINITY) + 1;
          const substitution = (diag ?? Number.POSITIVE_INFINITY) + 1;
          currentRow[j] = Math.min(insertion, deletion, substitution);
        }
      }
    }

    const lastRow = matrix[len2];
    const distance = lastRow?.[len1] ?? 0;
    const maxLen = Math.max(len1, len2);
    return Math.round((1 - distance / maxLen) * 100);
  };

  // Calculate similarity between two transactions
  const calculateSimilarity = (t1: Transaction, t2: Transaction): SimilarityScore => {
    // Ensure dates are Date objects
    const date1 = t1.date instanceof Date ? t1.date : new Date(t1.date);
    const date2 = t2.date instanceof Date ? t2.date : new Date(t2.date);
    
    // Date similarity (within threshold)
    const daysDiff = Math.abs(
      (date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dateScore = daysDiff <= dateThreshold ? 100 - (daysDiff / dateThreshold) * 50 : 0;
    
    // Amount similarity
    const amount1 = toDecimal(t1.amount).toNumber();
    const amount2 = toDecimal(t2.amount).toNumber();
    const amountDiff = Math.abs(amount1 - amount2);
    const amountScore = amountDiff <= amountThreshold ? 100 : 
      Math.max(0, 100 - (amountDiff / Math.max(amount1, amount2)) * 100);
    
    // Description similarity
    const descriptionScore = calculateStringSimilarity(t1.description, t2.description);
    
    // Total weighted score
    const totalScore = (dateScore * 0.3 + amountScore * 0.4 + descriptionScore * 0.3);
    
    return {
      dateScore,
      amountScore,
      descriptionScore,
      totalScore
    };
  };

  const normalizeTransaction = (source: Partial<Transaction>, fallbackId: string): Transaction | null => {
    const { date, description, amount } = source;
    if (!date || !description || amount === null || amount === undefined) {
      return null;
    }

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    const numericAmount = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return null;
    }

    const normalized: Transaction = {
      id: source.id ?? fallbackId,
      date: parsedDate,
      amount: numericAmount,
      description,
      category: source.category ?? '',
      accountId: source.accountId ?? '',
      type: source.type ?? 'expense',
      cleared: source.cleared ?? false
    };

    if (source.tags && source.tags.length > 0) {
      normalized.tags = source.tags;
    }
    if (source.notes) {
      normalized.notes = source.notes;
    }
    if (source.reconciledWith) {
      normalized.reconciledWith = source.reconciledWith;
    }
    if (source.reconciledDate) {
      normalized.reconciledDate = source.reconciledDate;
    }
    if (source.reconciledNotes) {
      normalized.reconciledNotes = source.reconciledNotes;
    }
    if (source.bankReference) {
      normalized.bankReference = source.bankReference;
    }
    if (source.isRecurring !== undefined) {
      normalized.isRecurring = source.isRecurring;
    }
    if (source.isSplit !== undefined) {
      normalized.isSplit = source.isSplit;
    }
    if (source.isImported !== undefined) {
      normalized.isImported = source.isImported;
    }
    if (source.pending !== undefined) {
      normalized.pending = source.pending;
    }
    if (source.plaidTransactionId) {
      normalized.plaidTransactionId = source.plaidTransactionId;
    }
    if (source.merchant) {
      normalized.merchant = source.merchant;
    }
    if (source.paymentChannel) {
      normalized.paymentChannel = source.paymentChannel;
    }
    if (source.location) {
      normalized.location = source.location;
    }
    if (source.goalId) {
      normalized.goalId = source.goalId;
    }
    if (source.accountName) {
      normalized.accountName = source.accountName;
    }
    if (source.recurringTransactionId) {
      normalized.recurringTransactionId = source.recurringTransactionId;
    }
    if (source.addedBy) {
      normalized.addedBy = source.addedBy;
    }
    if (source.linkedTransferId) {
      normalized.linkedTransferId = source.linkedTransferId;
    }
    if (source.transferMetadata) {
      normalized.transferMetadata = source.transferMetadata;
    }
    if (source.investmentData) {
      normalized.investmentData = source.investmentData;
    }

    return normalized;
  };

  // Find duplicates in existing transactions
  const findExistingDuplicates = useMemo(() => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    transactions.forEach((transaction, index) => {
      if (processed.has(transaction.id)) {
        return;
      }

      const potential: Transaction[] = [];

      for (let candidateIndex = index + 1; candidateIndex < transactions.length; candidateIndex += 1) {
        const candidate = transactions[candidateIndex];
        if (!candidate || processed.has(candidate.id)) {
          continue;
        }

        const similarity = calculateSimilarity(transaction, candidate);
        if (similarity.totalScore >= similarityThreshold) {
          potential.push(candidate);
          processed.add(candidate.id);
        }
      }

      if (potential.length > 0) {
        processed.add(transaction.id);
        const confidence = Math.max(
          ...potential.map((candidate) => calculateSimilarity(transaction, candidate).totalScore)
        );

        groups.push({
          original: transaction,
          potential,
          confidence
        });
      }
    });

    return groups;
  }, [transactions, similarityThreshold, dateThreshold, amountThreshold]);

  // Check new transactions against existing ones
  const checkNewTransactions = () => {
    if (!newTransactions || newTransactions.length === 0) return;
    
    setScanning(true);
    setScanProgress(0);
    
    const groups: DuplicateGroup[] = [];
    const toRemove = new Set<string>();

    newTransactions.forEach((candidate, index) => {
      const progress = ((index + 1) / newTransactions.length) * 100;
      setScanProgress(progress);

      const normalized = normalizeTransaction(candidate, `new-${index}`);
      if (!normalized) {
        return;
      }

      const matches: Transaction[] = [];

      transactions.forEach((existing) => {
        const similarity = calculateSimilarity(normalized, existing);
        if (similarity.totalScore >= similarityThreshold) {
          matches.push(existing);
        }
      });

      if (matches.length > 0) {
        const confidence = Math.max(
          ...matches.map((match) => calculateSimilarity(normalized, match).totalScore)
        );

        groups.push({
          original: normalized,
          potential: matches,
          confidence
        });

        if (autoSelectHighConfidence && confidence >= 90) {
          toRemove.add(normalized.id);
        }
      }
    });

    setDuplicateGroups(groups);
    setSelectedDuplicates(toRemove);
    setScanning(false);
  };

  // Run duplicate check when modal opens
  useEffect(() => {
    if (isOpen) {
      if (newTransactions) {
        checkNewTransactions();
      } else {
        setDuplicateGroups(findExistingDuplicates);
      }
    }
  }, [isOpen, newTransactions]);

  const handleToggleDuplicate = (id: string) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDuplicates(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>();
    duplicateGroups.forEach(group => {
      if (newTransactions) {
        allIds.add(group.original.id);
      } else {
        group.potential.forEach(t => allIds.add(t.id));
      }
    });
    setSelectedDuplicates(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedDuplicates(new Set());
  };

  const handleConfirm = () => {
    if (newTransactions) {
      // Filter out selected duplicates from new transactions
      const filtered = newTransactions.filter((_, index) => 
        !selectedDuplicates.has(`new-${index}`)
      );
      onConfirm?.(filtered);
    }
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-red-600 dark:text-red-400';
    if (confidence >= 75) return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return 'Very likely duplicate';
    if (confidence >= 75) return 'Likely duplicate';
    return 'Possible duplicate';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={newTransactions ? "Import Duplicate Check" : "Find Duplicate Transactions"}
      size="xl"
    >
      <div className="p-6">
        {/* Settings */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <FilterIcon size={18} />
            Detection Settings
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Date Threshold (days)
              </label>
              <input
                type="number"
                value={dateThreshold}
                onChange={(e) => setDateThreshold(parseInt(e.target.value) || 0)}
                min="0"
                max="30"
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded
                         bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount Threshold (£)
              </label>
              <input
                type="number"
                value={amountThreshold}
                onChange={(e) => setAmountThreshold(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded
                         bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Similarity Threshold (%)
              </label>
              <input
                type="range"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseInt(e.target.value))}
                min="50"
                max="100"
                className="w-full"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {similarityThreshold}%
              </span>
            </div>
          </div>
          {newTransactions && (
            <label className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                checked={autoSelectHighConfidence}
                onChange={(e) => setAutoSelectHighConfidence(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-select very likely duplicates (90%+)</span>
            </label>
          )}
        </div>

        {/* Progress bar for scanning */}
        {scanning && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Scanning for duplicates...</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {Math.round(scanProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Results summary */}
        {!scanning && duplicateGroups.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="text-orange-600 dark:text-orange-400 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 dark:text-orange-300">
                  {newTransactions 
                    ? `Found ${duplicateGroups.length} potential duplicates in import`
                    : `Found ${duplicateGroups.length} duplicate groups`
                  }
                </h4>
                <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                  {newTransactions 
                    ? "Review and deselect any transactions you want to import anyway."
                    : "Review and select which duplicates to remove."
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1 text-sm border border-orange-600 text-orange-600 
                           dark:text-orange-400 dark:border-orange-400 rounded hover:bg-orange-50
                           dark:hover:bg-orange-900/20"
                >
                  Deselect All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No duplicates found */}
        {!scanning && duplicateGroups.length === 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 text-center">
            <CheckIcon className="mx-auto text-green-600 dark:text-green-400 mb-3" size={48} />
            <h4 className="font-medium text-green-900 dark:text-green-300">
              No duplicates found!
            </h4>
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">
              {newTransactions 
                ? "All transactions in the import appear to be unique."
                : "Your transaction history doesn't contain any duplicates."
              }
            </p>
          </div>
        )}

        {/* Duplicate groups */}
        {!scanning && duplicateGroups.length > 0 && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {duplicateGroups.map((group, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {newTransactions && (
                      <input
                        type="checkbox"
                        checked={selectedDuplicates.has(group.original.id)}
                        onChange={() => handleToggleDuplicate(group.original.id)}
                        className="mt-1"
                      />
                    )}
                    <div>
                      <div className="font-medium">{group.original.description}</div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <CalendarIcon size={14} />
                          {(group.original.date instanceof Date ? group.original.date : new Date(group.original.date)).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSignIcon size={14} />
                          {formatCurrency(group.original.amount)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileTextIcon size={14} />
                          {group.original.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${getConfidenceColor(group.confidence)}`}>
                    {Math.round(group.confidence)}% match
                  </div>
                </div>

                <div className="ml-7 space-y-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getConfidenceLabel(group.confidence)} with:
                  </div>
                  {group.potential.map(transaction => (
                    <div key={transaction.id} className="flex items-center justify-between bg-gray-50 
                                                       dark:bg-gray-800 rounded p-2">
                      <div className="flex items-center gap-3">
                        {!newTransactions && (
                          <input
                            type="checkbox"
                            checked={selectedDuplicates.has(transaction.id)}
                            onChange={() => handleToggleDuplicate(transaction.id)}
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium">{transaction.description}</div>
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                            <span>{(transaction.date instanceof Date ? transaction.date : new Date(transaction.date)).toLocaleDateString()}</span>
                            <span>{formatCurrency(transaction.amount)}</span>
                            <span>{transaction.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {calculateSimilarity(group.original, transaction).totalScore.toFixed(0)}% similar
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                     dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          {duplicateGroups.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={newTransactions && selectedDuplicates.size === newTransactions.length}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                       hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {newTransactions ? (
                <>
                  <CheckIcon size={20} />
                  Import {newTransactions.length - selectedDuplicates.size} Unique Transactions
                </>
              ) : (
                <>
                  <TrashIcon size={20} />
                  Remove {selectedDuplicates.size} Duplicates
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
