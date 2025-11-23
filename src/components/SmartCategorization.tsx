import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckIcon, 
  XIcon, 
  SparklesIcon,
  RefreshCwIcon,
  ChevronRightIcon,
  AlertCircleIcon
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import { smartCategorizationService } from '../services/smartCategorizationService';
import type { Transaction } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface CategorizationSuggestion {
  categoryId: string;
  confidence: number;
  reason: string;
}

interface SmartCategorizationProps {
  transaction: Transaction;
  onCategoryChange: (categoryId: string) => void;
  showInline?: boolean;
  autoLearn?: boolean;
}

/**
 * Smart Transaction Categorization Component
 * Design principles:
 * 1. AI-powered suggestions based on patterns
 * 2. Learning from user corrections
 * 3. Visual confidence indicators
 * 4. One-click application
 * 5. Bulk suggestions support
 */
export function SmartCategorization({ 
  transaction, 
  onCategoryChange,
  showInline = true,
  autoLearn = true
}: SmartCategorizationProps): React.JSX.Element | null {
  const { categories, transactions } = useApp();
  const { formatCurrency: _formatCurrency } = useCurrencyDecimal();
  const [suggestions, setSuggestions] = useState<CategorizationSuggestion[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Learn from existing transactions on mount and when transactions change
  useEffect(() => {
    if (autoLearn && transactions.length > 0) {
      setIsLearning(true);
      // Use setTimeout to avoid blocking UI
      setTimeout(() => {
        smartCategorizationService.learnFromTransactions(transactions, categories);
        setIsLearning(false);
      }, 100);
    }
  }, [transactions, categories, autoLearn]);

  // Generate suggestions for the transaction
  useEffect(() => {
    if (!transaction || transaction.category || isLearning) return;
    
    const newSuggestions = smartCategorizationService.suggestCategories(transaction, 5);
    setSuggestions(newSuggestions);
  }, [transaction, isLearning]);

  // Apply suggestion and learn from it
  const applySuggestion = useCallback((categoryId: string) => {
    onCategoryChange(categoryId);
    
    // Learn from this categorization
    if (autoLearn) {
      smartCategorizationService.learnFromCorrection(transaction, categoryId);
    }
    
    // Clear suggestions after applying
    setSuggestions([]);
  }, [transaction, onCategoryChange, autoLearn]);

  // Reject suggestion and learn from it
  const rejectSuggestion = useCallback((categoryId: string) => {
    // Remove this suggestion
    setSuggestions(prev => prev.filter(s => s.categoryId !== categoryId));
    
    // Learn that this was wrong
    if (autoLearn) {
      smartCategorizationService.learnFromRejection(transaction, categoryId);
    }
  }, [transaction, autoLearn]);

  // Refresh suggestions
  const refreshSuggestions = useCallback(() => {
    setIsLearning(true);
    setTimeout(() => {
      smartCategorizationService.learnFromTransactions(transactions, categories);
      const newSuggestions = smartCategorizationService.suggestCategories(transaction, 5);
      setSuggestions(newSuggestions);
      setIsLearning(false);
    }, 100);
  }, [transaction, transactions, categories]);

  // Don't show if transaction already has a category or no suggestions
  if (transaction.category || suggestions.length === 0) {
    return null;
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    const percent = confidence * 100;
    if (percent >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    if (percent >= 60) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    const percent = confidence * 100;
    if (percent >= 80) return 'High';
    if (percent >= 60) return 'Medium';
    return 'Low';
  };

  const topSuggestion = suggestions[0];
  const topCategory = categories.find(c => c.id === topSuggestion.categoryId);

  if (!topCategory) return null;

  // Inline compact view
  if (showInline) {
    return (
      <div className="flex items-center gap-2 py-1">
        <SparklesIcon size={14} className="text-purple-500 flex-shrink-0" />
        <span className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
          AI suggests:
        </span>
        
        {/* Primary suggestion */}
        <button
          onClick={() => applySuggestion(topSuggestion.categoryId)}
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full
            hover:scale-105 transition-all duration-200
            ${getConfidenceColor(topSuggestion.confidence)}
          `}
          title={`${topSuggestion.reason} (${Math.round(topSuggestion.confidence * 100)}% confidence)`}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: topCategory.color }}
          />
          <span className="font-medium">{topCategory.name}</span>
          <span className="font-semibold">
            {Math.round(topSuggestion.confidence * 100)}%
          </span>
          <CheckIcon size={12} className="opacity-60" />
        </button>

        {/* More suggestions indicator */}
        {suggestions.length > 1 && (
          <button
            onClick={() => setShowAllSuggestions(!showAllSuggestions)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-0.5"
          >
            <span>+{suggestions.length - 1} more</span>
            <ChevronRightIcon 
              size={12} 
              className={`transition-transform ${showAllSuggestions ? 'rotate-90' : ''}`}
            />
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={refreshSuggestions}
          disabled={isLearning}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          title="Refresh suggestions"
        >
          <RefreshCwIcon size={12} className={isLearning ? 'animate-spin' : ''} />
        </button>

        {/* Additional suggestions dropdown */}
        {showAllSuggestions && suggestions.length > 1 && (
          <div className="absolute z-10 mt-8 bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]">
            {suggestions.slice(1).map(suggestion => {
              const category = categories.find(c => c.id === suggestion.categoryId);
              if (!category) return null;
              
              return (
                <div
                  key={suggestion.categoryId}
                  className="flex items-center justify-between gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <button
                    onClick={() => applySuggestion(suggestion.categoryId)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${getConfidenceColor(suggestion.confidence)}`}>
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </button>
                  <button
                    onClick={() => rejectSuggestion(suggestion.categoryId)}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="This suggestion is incorrect"
                  >
                    <XIcon size={12} className="text-red-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Full card view (for bulk operations)
  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <SparklesIcon size={20} className="text-purple-600 dark:text-purple-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            AI Category Suggestions
          </h4>
        </div>
        <button
          onClick={refreshSuggestions}
          disabled={isLearning}
          className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh suggestions"
        >
          <RefreshCwIcon size={16} className={isLearning ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const category = categories.find(c => c.id === suggestion.categoryId);
          if (!category) return null;
          
          const confidencePercent = Math.round(suggestion.confidence * 100);
          
          return (
            <div
              key={suggestion.categoryId}
              className={`
                flex items-center justify-between gap-3 p-3 rounded-lg border
                ${index === 0 
                  ? 'border-purple-300 dark:border-purple-700 bg-[#d4dce8] dark:bg-gray-800' 
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                }
              `}
            >
              <div className="flex items-center gap-3 flex-1">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getConfidenceColor(suggestion.confidence)}`}>
                      {confidencePercent}% - {getConfidenceLabel(suggestion.confidence)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {suggestion.reason}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => applySuggestion(suggestion.categoryId)}
                  className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg transition-colors"
                  title="Apply this category"
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  onClick={() => rejectSuggestion(suggestion.categoryId)}
                  className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors"
                  title="This is incorrect"
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {suggestions.length === 0 && !isLearning && (
        <div className="text-center py-4">
          <AlertCircleIcon size={24} className="text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No suggestions available. The AI needs more data to learn from your categorization patterns.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk Categorization Component
 * For applying suggestions to multiple transactions at once
 */
interface BulkCategorizationProps {
  transactions: Transaction[];
  onApply: (updates: { transactionId: string; categoryId: string }[]) => void;
  onClose: () => void;
}

export function BulkCategorization({ 
  transactions, 
  onApply, 
  onClose 
}: BulkCategorizationProps): React.JSX.Element {
  const { categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [suggestions, setSuggestions] = useState<Map<string, CategorizationSuggestion[]>>(new Map());
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(true);

  // Generate suggestions for all transactions
  useEffect(() => {
    setIsProcessing(true);
    const newSuggestions = new Map<string, CategorizationSuggestion[]>();
    
    // Process in batches to avoid blocking UI
    const processBatch = (batch: Transaction[]) => {
      batch.forEach(transaction => {
        if (!transaction.category) {
          const transSuggestions = smartCategorizationService.suggestCategories(transaction, 3);
          if (transSuggestions.length > 0) {
            newSuggestions.set(transaction.id, transSuggestions);
            // Auto-select high confidence suggestions
            if (transSuggestions[0].confidence >= 0.8) {
              setSelected(prev => new Map(prev).set(transaction.id, transSuggestions[0].categoryId));
            }
          }
        }
      });
    };

    // Process in chunks of 10
    const chunks: Transaction[][] = [];
    for (let i = 0; i < transactions.length; i += 10) {
      chunks.push(transactions.slice(i, i + 10));
    }

    let currentChunk = 0;
    const processNextChunk = () => {
      if (currentChunk < chunks.length) {
        processBatch(chunks[currentChunk]);
        currentChunk++;
        setTimeout(processNextChunk, 50);
      } else {
        setSuggestions(newSuggestions);
        setIsProcessing(false);
      }
    };

    processNextChunk();
  }, [transactions]);

  const handleApply = () => {
    const updates = Array.from(selected.entries()).map(([transactionId, categoryId]) => ({
      transactionId,
      categoryId
    }));
    onApply(updates);
  };

  const toggleSelection = (transactionId: string, categoryId: string) => {
    setSelected(prev => {
      const newSelected = new Map(prev);
      if (newSelected.get(transactionId) === categoryId) {
        newSelected.delete(transactionId);
      } else {
        newSelected.set(transactionId, categoryId);
      }
      return newSelected;
    });
  };

  const selectAllHighConfidence = () => {
    const newSelected = new Map<string, string>();
    suggestions.forEach((transSuggestions, transactionId) => {
      if (transSuggestions[0].confidence >= 0.7) {
        newSelected.set(transactionId, transSuggestions[0].categoryId);
      }
    });
    setSelected(newSelected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon size={24} className="text-purple-600 dark:text-purple-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Bulk Smart Categorization
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  AI suggestions for {suggestions.size} uncategorized transactions
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Actions bar */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selected.size} selected for categorization
              </span>
            </div>
            <button
              onClick={selectAllHighConfidence}
              className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              Select all high confidence (70%+)
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isProcessing ? (
            <div className="text-center py-12">
              <RefreshCwIcon size={32} className="animate-spin text-purple-600 dark:text-purple-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Analyzing transactions...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(suggestions.entries()).map(([transactionId, transSuggestions]) => {
                const transaction = transactions.find(t => t.id === transactionId);
                if (!transaction) return null;
                
                return (
                  <div key={transactionId} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <div className="mb-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(transaction.date).toLocaleDateString()} • 
                        {formatCurrency(Math.abs(transaction.amount))}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {transSuggestions.map(suggestion => {
                        const category = categories.find(c => c.id === suggestion.categoryId);
                        if (!category) return null;
                        
                        const isSelected = selected.get(transactionId) === suggestion.categoryId;
                        
                        return (
                          <button
                            key={suggestion.categoryId}
                            onClick={() => toggleSelection(transactionId, suggestion.categoryId)}
                            className={`
                              flex items-center gap-2 p-2 rounded-lg border transition-all
                              ${isSelected 
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }
                            `}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left">
                              {category.name}
                            </span>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                            {isSelected && <CheckIcon size={16} className="text-purple-600 dark:text-purple-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Review selections before applying
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={selected.size === 0}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <SparklesIcon size={16} />
                Apply to {selected.size} transactions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
