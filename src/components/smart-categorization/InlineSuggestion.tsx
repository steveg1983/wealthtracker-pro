import { memo, useState, useEffect } from 'react';
import { SparklesIcon, CheckIcon, ChevronRightIcon, RefreshCwIcon } from '../icons';
import type { Category } from '../../types';
import { logger } from '../../services/loggingService';

interface InlineSuggestionProps {
  suggestions: Array<{ categoryId: string; confidence: number; reason: string }>;
  categories: Category[];
  isLearning: boolean;
  onApply: (categoryId: string) => void;
  onReject: (categoryId: string) => void;
  onRefresh: () => void;
}

/**
 * Inline suggestion component
 * Shows compact AI category suggestions inline
 */
export const InlineSuggestion = memo(function InlineSuggestion({
  suggestions,
  categories,
  isLearning,
  onApply,
  onReject,
  onRefresh
}: InlineSuggestionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('InlineSuggestion component initialized', {
      componentName: 'InlineSuggestion'
    });
  }, []);

  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const getConfidenceColor = (confidence: number) => {
    const percent = confidence * 100;
    if (percent >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    if (percent >= 60) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
  };

  const topSuggestion = suggestions[0];
  const topCategory = categories.find(c => c.id === topSuggestion.categoryId);

  if (!topCategory) return <></>;

  return (
    <div className="flex items-center gap-2 py-1 relative">
      <SparklesIcon size={14} className="text-purple-500 flex-shrink-0" />
      <span className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
        AI suggests:
      </span>
      
      {/* Primary suggestion */}
      <button
        onClick={() => onApply(topSuggestion.categoryId)}
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
        onClick={onRefresh}
        disabled={isLearning}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
        title="Refresh suggestions"
      >
        <RefreshCwIcon size={12} className={isLearning ? 'animate-spin' : ''} />
      </button>

      {/* Additional suggestions dropdown */}
      {showAllSuggestions && suggestions.length > 1 && (
        <SuggestionsDropdown
          suggestions={suggestions.slice(1)}
          categories={categories}
          onApply={onApply}
          onReject={onReject}
          getConfidenceColor={getConfidenceColor}
        />
      )}
    </div>
  );
});

// Dropdown sub-component
interface SuggestionsDropdownProps {
  suggestions: Array<{ categoryId: string; confidence: number; reason: string }>;
  categories: Category[];
  onApply: (categoryId: string) => void;
  onReject: (categoryId: string) => void;
  getConfidenceColor: (confidence: number) => string;
}

const SuggestionsDropdown = memo(function SuggestionsDropdown({
  suggestions,
  categories,
  onApply,
  onReject,
  getConfidenceColor
}: SuggestionsDropdownProps) {
  return (
    <div className="absolute z-10 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]">
      {suggestions.map(suggestion => {
        const category = categories.find(c => c.id === suggestion.categoryId);
        if (!category) return <></>;
        
        return (
          <div
            key={suggestion.categoryId}
            className="flex items-center justify-between gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <button
              onClick={() => onApply(suggestion.categoryId)}
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
              onClick={() => onReject(suggestion.categoryId)}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="This suggestion is incorrect"
            >
              <span className="text-red-500 text-xs">✕</span>
            </button>
          </div>
        );
      })}
    </div>
  );
});