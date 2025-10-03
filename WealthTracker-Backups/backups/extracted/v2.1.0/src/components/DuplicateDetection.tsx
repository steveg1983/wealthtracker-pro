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
    
    const matrix: number[][] = [];
    const len1 = s1.length;
    const len2 = s2.length;
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
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

  // Find duplicates in existing transactions
  const findExistingDuplicates = useMemo(() => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    
    for (let i = 0; i < transactions.length; i++) {
      if (processed.has(transactions[i].id)) continue;
      
      const potential: Transaction[] = [];
      
      for (let j = i + 1; j < transactions.length; j++) {
        if (processed.has(transactions[j].id)) continue;
        
        const similarity = calculateSimilarity(transactions[i], transactions[j]);
        
        if (similarity.totalScore >= similarityThreshold) {
          potential.push(transactions[j]);
          processed.add(transactions[j].id);
        }
      }
      
      if (potential.length > 0) {
        processed.add(transactions[i].id);
        groups.push({
          original: transactions[i],
          potential,
          confidence: Math.max(...potential.map(t => 
            calculateSimilarity(transactions[i], t).totalScore
          ))
        });
      }
    }
    
    return groups;
  }, [transactions, similarityThreshold, dateThreshold, amountThreshold]);

  // Check new transactions against existing ones
  const checkNewTransactions = () => {
    if (!newTransactions || newTransactions.length === 0) return;
    
    setScanning(true);
    setScanProgress(0);
    
    const groups: DuplicateGroup[] = [];
    const toRemove = new Set<string>();
    
    newTransactions.forEach((newTrans, index) => {
      setScanProgress(((index + 1) / newTransactions.length) * 100);
      
      const matches: Transaction[] = [];
      
      transactions.forEach(existing => {
        if (!newTrans.date || !newTrans.description || newTrans.amount === undefined) return;
        
        const tempTransaction: Transaction = {
          ...newTrans,
          id: `new-${index}`,
          date: newTrans.date,
          description: newTrans.description,
          amount: newTrans.amount,
          type: newTrans.type || 'expense',
          accountId: newTrans.accountId || '',
          category: newTrans.category || '',
          cleared: newTrans.cleared || false
        };
        
        const similarity = calculateSimilarity(tempTransaction, existing);
        
        if (similarity.totalScore >= similarityThreshold) {
          matches.push(existing);
        }
      });
      
      if (matches.length > 0) {
        const confidence = Math.max(...matches.map(t => 
          calculateSimilarity({
            ...newTrans,
            id: `new-${index}`,
            date: newTrans.date!,
            description: newTrans.description!,
            amount: newTrans.amount!,
            type: newTrans.type || 'expense',
            accountId: newTrans.accountId || '',
            category: newTrans.category || '',
            cleared: newTrans.cleared || false
          }, t).totalScore
        ));
        
        groups.push({
          original: {
            ...newTrans,
            id: `new-${index}`,
            date: newTrans.date!,
            description: newTrans.description!,
            amount: newTrans.amount!,
            type: newTrans.type || 'expense',
            accountId: newTrans.accountId || '',
            category: newTrans.category || '',
            cleared: newTrans.cleared || false
          },
          potential: matches,
          confidence
        });
        
        if (autoSelectHighConfidence && confidence >= 90) {
          toRemove.add(`new-${index}`);
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