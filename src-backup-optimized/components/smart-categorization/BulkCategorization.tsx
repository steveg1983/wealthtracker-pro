import { memo, useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { SparklesIcon, XIcon, CheckIcon, RefreshCwIcon } from '../icons';
import { smartCategorizationService } from '../../services/smartCategorizationService';
import type { Transaction } from '../../types';
import type { CategorizationSuggestion } from '../SmartCategorization';
import { useLogger } from '../services/ServiceProvider';

interface BulkCategorizationProps {
  transactions: Transaction[];
  onApply: (updates: { transactionId: string; categoryId: string }[]) => void;
  onClose: () => void;
}

/**
 * Bulk Categorization Component
 * Apply AI suggestions to multiple transactions at once
 */
export const BulkCategorization = memo(function BulkCategorization({ transactions, 
  onApply, 
  onClose 
 }: BulkCategorizationProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BulkCategorization component initialized', {
      componentName: 'BulkCategorization'
    });
  }, []);

  const { categories } = useApp();
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <BulkCategorizationHeader
          suggestionsCount={suggestions.size}
          onClose={onClose}
        />

        {/* Actions bar */}
        <BulkCategorizationActions
          selectedCount={selected.size}
          onSelectAllHighConfidence={selectAllHighConfidence}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isProcessing ? (
            <ProcessingIndicator />
          ) : (
            <TransactionSuggestionsList
              suggestions={suggestions}
              transactions={transactions}
              categories={categories.map(cat => ({ id: cat.id, name: cat.name, color: cat.color || '#808080' }))}
              selected={selected}
              onToggleSelection={toggleSelection}
            />
          )}
        </div>

        {/* Footer */}
        <BulkCategorizationFooter
          selectedCount={selected.size}
          onClose={onClose}
          onApply={handleApply}
        />
      </div>
    </div>
  );
});

// Header sub-component
interface BulkCategorizationHeaderProps {
  suggestionsCount: number;
  onClose: () => void;
}

const BulkCategorizationHeader = memo(function BulkCategorizationHeader({
  suggestionsCount,
  onClose
}: BulkCategorizationHeaderProps) {
  const logger = useLogger();
  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SparklesIcon size={24} className="text-purple-600 dark:text-purple-400" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Bulk Smart Categorization
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              AI suggestions for {suggestionsCount} uncategorized transactions
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
  );
});

// Actions bar sub-component
interface BulkCategorizationActionsProps {
  selectedCount: number;
  onSelectAllHighConfidence: () => void;
}

const BulkCategorizationActions = memo(function BulkCategorizationActions({
  selectedCount,
  onSelectAllHighConfidence
}: BulkCategorizationActionsProps) {
  const logger = useLogger();
  return (
    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCount} selected for categorization
          </span>
        </div>
        <button
          onClick={onSelectAllHighConfidence}
          className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
        >
          Select all high confidence (70%+)
        </button>
      </div>
    </div>
  );
});

// Processing indicator sub-component
const ProcessingIndicator = memo(function ProcessingIndicator() {
  return (
    <div className="text-center py-12">
      <RefreshCwIcon size={32} className="animate-spin text-purple-600 dark:text-purple-400 mx-auto mb-4" />
      <p className="text-gray-600 dark:text-gray-400">
        Analyzing transactions...
      </p>
    </div>
  );
});

// Transaction suggestions list sub-component
interface TransactionSuggestionsListProps {
  suggestions: Map<string, CategorizationSuggestion[]>;
  transactions: Transaction[];
  categories: Array<{ id: string; name: string; color: string }>;
  selected: Map<string, string>;
  onToggleSelection: (transactionId: string, categoryId: string) => void;
}

const TransactionSuggestionsList = memo(function TransactionSuggestionsList({
  suggestions,
  transactions,
  categories,
  selected,
  onToggleSelection
}: TransactionSuggestionsListProps) {
  const logger = useLogger();
  return (
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
                ${Math.abs(transaction.amount as number).toFixed(2)}
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
                    onClick={() => onToggleSelection(transactionId, suggestion.categoryId)}
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
  );
});

// Footer sub-component
interface BulkCategorizationFooterProps {
  selectedCount: number;
  onClose: () => void;
  onApply: () => void;
}

const BulkCategorizationFooter = memo(function BulkCategorizationFooter({
  selectedCount,
  onClose,
  onApply
}: BulkCategorizationFooterProps) {
  const logger = useLogger();
  return (
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
            onClick={onApply}
            disabled={selectedCount === 0}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <SparklesIcon size={16} />
            Apply to {selectedCount} transactions
          </button>
        </div>
      </div>
    </div>
  );
});