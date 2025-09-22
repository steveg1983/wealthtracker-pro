/**
 * DuplicateDetection Component - Detects and handles duplicate financial transactions
 *
 * Features:
 * - Automatic duplicate transaction detection
 * - Manual duplicate resolution
 * - Batch duplicate processing
 * - Configurable duplicate criteria
 * - Preview duplicate merges
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('DuplicateDetection');

export interface DuplicateTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  account_id: string;
  similarity_score: number;
  potential_matches: DuplicateTransaction[];
}

export interface DuplicateGroup {
  id: string;
  transactions: DuplicateTransaction[];
  confidence: 'high' | 'medium' | 'low';
  suggested_action: 'merge' | 'keep_separate' | 'review';
}

interface DuplicateDetectionProps {
  transactions?: DuplicateTransaction[];
  onResolveDuplicates?: (resolved: DuplicateGroup[]) => Promise<void>;
  onClose?: () => void;
  className?: string;
  autoDetect?: boolean;
  threshold?: number;
}

export function DuplicateDetection({
  transactions = [],
  onResolveDuplicates,
  onClose,
  className = '',
  autoDetect = true,
  threshold = 0.8
}: DuplicateDetectionProps): React.JSX.Element {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionSettings, setDetectionSettings] = useState({
    dateRange: 7, // days
    amountTolerance: 0.01, // 1 cent
    descriptionSimilarity: 0.8,
    includeCategory: true
  });

  useEffect(() => {
    if (autoDetect && transactions.length > 0) {
      detectDuplicates();
    }
  }, [transactions, autoDetect]);

  const detectDuplicates = (): void => {
    logger.info('Starting duplicate detection', {
      transactionCount: transactions.length,
      threshold
    });

    setIsProcessing(true);

    try {
      // Mock duplicate detection logic
      const groups: DuplicateGroup[] = [];

      // Group similar transactions
      const processed = new Set<string>();

      transactions.forEach(transaction => {
        if (processed.has(transaction.id)) return;

        const similarTransactions = transactions.filter(t =>
          !processed.has(t.id) &&
          Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime())
            <= detectionSettings.dateRange * 24 * 60 * 60 * 1000 &&
          Math.abs(t.amount - transaction.amount) <= detectionSettings.amountTolerance &&
          calculateSimilarity(t.description, transaction.description) >= detectionSettings.descriptionSimilarity
        );

        if (similarTransactions.length > 1) {
          similarTransactions.forEach(t => processed.add(t.id));

          groups.push({
            id: `group-${transaction.id}`,
            transactions: similarTransactions,
            confidence: similarTransactions.length > 2 ? 'high' : 'medium',
            suggested_action: similarTransactions.length > 2 ? 'merge' : 'review'
          });
        }
      });

      setDuplicateGroups(groups);
      logger.info('Duplicate detection completed', { groupsFound: groups.length });
    } catch (error) {
      logger.error('Error detecting duplicates:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple similarity calculation (Levenshtein distance normalized)
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  };

  const handleGroupSelection = (groupId: string): void => {
    const newSelection = new Set(selectedGroups);
    if (newSelection.has(groupId)) {
      newSelection.delete(groupId);
    } else {
      newSelection.add(groupId);
    }
    setSelectedGroups(newSelection);
  };

  const handleResolveDuplicates = async (): Promise<void> => {
    if (!onResolveDuplicates || selectedGroups.size === 0) return;

    setIsProcessing(true);
    try {
      const groupsToResolve = duplicateGroups.filter(group =>
        selectedGroups.has(group.id)
      );

      await onResolveDuplicates(groupsToResolve);

      // Remove resolved groups
      setDuplicateGroups(prev =>
        prev.filter(group => !selectedGroups.has(group.id))
      );
      setSelectedGroups(new Set());

      logger.info('Duplicates resolved', { resolvedCount: groupsToResolve.length });
    } catch (error) {
      logger.error('Error resolving duplicates:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const formattedAmount = `£${absAmount.toFixed(2)}`;
    return amount >= 0 ? `+${formattedAmount}` : `-${formattedAmount}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getConfidenceColor = (confidence: string): string => {
    switch (confidence) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Duplicate Detection
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {duplicateGroups.length === 0
                ? 'No duplicates found'
                : `Found ${duplicateGroups.length} potential duplicate groups`
              }
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={detectDuplicates}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {isProcessing ? 'Detecting...' : 'Re-scan'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Detection Settings */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Detection Settings
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range (days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={detectionSettings.dateRange}
                onChange={(e) => setDetectionSettings(prev => ({
                  ...prev,
                  dateRange: parseInt(e.target.value) || 7
                }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount Tolerance (£)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={detectionSettings.amountTolerance}
                onChange={(e) => setDetectionSettings(prev => ({
                  ...prev,
                  amountTolerance: parseFloat(e.target.value) || 0.01
                }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description Similarity
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={detectionSettings.descriptionSimilarity}
                onChange={(e) => setDetectionSettings(prev => ({
                  ...prev,
                  descriptionSimilarity: parseFloat(e.target.value) || 0.8
                }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={detectionSettings.includeCategory}
                  onChange={(e) => setDetectionSettings(prev => ({
                    ...prev,
                    includeCategory: e.target.checked
                  }))}
                  className="mr-2"
                />
                Include Category
              </label>
            </div>
          </div>
        </div>

        {/* Duplicate Groups */}
        {duplicateGroups.length > 0 && (
          <div className="space-y-4">
            {duplicateGroups.map((group) => (
              <div
                key={group.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.id)}
                      onChange={() => handleGroupSelection(group.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(group.confidence)}`}>
                      {group.confidence.toUpperCase()} CONFIDENCE
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Suggested: {group.suggested_action.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {group.transactions.length} transactions
                  </span>
                </div>

                <div className="space-y-2">
                  {group.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(transaction.date)}
                          {transaction.category && ` • ${transaction.category}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatAmount(transaction.amount)}
                        </div>
                        {transaction.similarity_score && (
                          <div className="text-xs text-gray-500">
                            {Math.round(transaction.similarity_score * 100)}% match
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {duplicateGroups.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedGroups.size} groups selected
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setSelectedGroups(new Set())}
                disabled={selectedGroups.size === 0}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 disabled:opacity-50"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setSelectedGroups(new Set(duplicateGroups.map(g => g.id)))}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <button
                onClick={handleResolveDuplicates}
                disabled={selectedGroups.size === 0 || isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Resolve Selected'}
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {duplicateGroups.length === 0 && !isProcessing && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              No Duplicates Found
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your transactions appear to be unique. Try adjusting the detection settings if needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DuplicateDetection;