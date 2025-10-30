import React, { useState } from 'react';
import { AlertTriangle, Check, X, Info } from 'lucide-react';
import { Transaction } from '../types';
import { DuplicateMatch, DuplicateDetectionService } from '../services/duplicateDetectionService';
import { formatCurrency } from '../utils/formatters';
import { format } from 'date-fns';

interface DuplicateDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateMatch[];
  onResolve: (action: 'keep' | 'skip' | 'both', transaction: Transaction) => void;
  onResolveAll: (action: 'keep' | 'skip') => void;
}

export default function DuplicateDetectionModal({
  isOpen,
  onClose,
  duplicates,
  onResolve,
  onResolveAll
}: DuplicateDetectionModalProps): React.JSX.Element | null {
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());
  const [selectedAction, setSelectedAction] = useState<'keep' | 'skip' | 'both' | null>(null);

  if (!isOpen) return null;

  const unresolvedDuplicates = duplicates.filter(
    d => !resolvedItems.has(d.transaction.id)
  );

  const handleResolve = (action: 'keep' | 'skip' | 'both', duplicate: DuplicateMatch) => {
    setResolvedItems(prev => new Set(prev).add(duplicate.transaction.id));
    onResolve(action, duplicate.transaction);
    
    if (unresolvedDuplicates.length <= 1) {
      setTimeout(() => onClose(), 500);
    }
  };

  const handleResolveAll = (action: 'keep' | 'skip') => {
    onResolveAll(action);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-red-600 bg-red-100';
    if (confidence >= 80) return 'text-orange-600 bg-orange-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-yellow-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Potential Duplicates Detected
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {unresolvedDuplicates.length} potential duplicate{unresolvedDuplicates.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        {unresolvedDuplicates.length > 1 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quick actions for all duplicates:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolveAll('skip')}
                  className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Skip All Duplicates
                </button>
                <button
                  onClick={() => handleResolveAll('keep')}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Import All Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Duplicates List */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {unresolvedDuplicates.length === 0 ? (
            <div className="text-center py-8">
              <Check size={48} className="mx-auto text-green-500 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                All duplicates have been resolved!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {unresolvedDuplicates.map((duplicate, index) => (
                <div
                  key={duplicate.transaction.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(duplicate.confidence)}`}>
                        {duplicate.confidence}% Match
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolve('skip', duplicate)}
                        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => handleResolve('both', duplicate)}
                        className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        Keep Both
                      </button>
                      <button
                        onClick={() => handleResolve('keep', duplicate)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Import
                      </button>
                    </div>
                  </div>

                  {/* Match Reasons */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-gray-500 mt-0.5" />
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Match reasons:</span>{' '}
                        {duplicate.matchReasons.join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* New Transaction */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        New Transaction (To Import)
                      </h4>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {duplicate.transaction.description}
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <p>Date: {format(new Date(duplicate.transaction.date), 'MMM d, yyyy')}</p>
                          <p>Amount: {formatCurrency(duplicate.transaction.amount)}</p>
                          <p>Category: {duplicate.transaction.category}</p>
                        </div>
                      </div>
                    </div>

                    {/* Existing Transaction */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Existing Transaction
                      </h4>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {duplicate.matchingTransaction.description}
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <p>Date: {format(new Date(duplicate.matchingTransaction.date), 'MMM d, yyyy')}</p>
                          <p>Amount: {formatCurrency(duplicate.matchingTransaction.amount)}</p>
                          <p>Category: {duplicate.matchingTransaction.category}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}