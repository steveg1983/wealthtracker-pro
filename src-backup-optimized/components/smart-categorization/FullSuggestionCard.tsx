import { memo, useEffect } from 'react';
import { SparklesIcon, CheckIcon, XIcon, RefreshCwIcon, AlertCircleIcon } from '../icons';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface FullSuggestionCardProps {
  suggestions: Array<{ categoryId: string; confidence: number; reason: string }>;
  categories: Category[];
  isLearning: boolean;
  onApply: (categoryId: string) => void;
  onReject: (categoryId: string) => void;
  onRefresh: () => void;
}

/**
 * Full suggestion card component
 * Shows detailed AI category suggestions in card format
 */
export const FullSuggestionCard = memo(function FullSuggestionCard({ suggestions,
  categories,
  isLearning,
  onApply,
  onReject,
  onRefresh
 }: FullSuggestionCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FullSuggestionCard component initialized', {
      componentName: 'FullSuggestionCard'
    });
  }, []);

  const getConfidenceColor = (confidence: number) => {
    const percent = confidence * 100;
    if (percent >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    if (percent >= 60) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
  };

  const getConfidenceLabel = (confidence: number) => {
    const percent = confidence * 100;
    if (percent >= 80) return 'High';
    if (percent >= 60) return 'Medium';
    return 'Low';
  };

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
          onClick={onRefresh}
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
            <SuggestionRow
              key={suggestion.categoryId}
              suggestion={suggestion}
              category={category}
              isTop={index === 0}
              confidencePercent={confidencePercent}
              getConfidenceColor={getConfidenceColor}
              getConfidenceLabel={getConfidenceLabel}
              onApply={onApply}
              onReject={onReject}
            />
          );
        })}
      </div>

      {suggestions.length === 0 && !isLearning && (
        <NoSuggestionsMessage />
      )}
    </div>
  );
});

// Suggestion row sub-component
interface SuggestionRowProps {
  suggestion: { categoryId: string; confidence: number; reason: string };
  category: Category;
  isTop: boolean;
  confidencePercent: number;
  getConfidenceColor: (confidence: number) => string;
  getConfidenceLabel: (confidence: number) => string;
  onApply: (categoryId: string) => void;
  onReject: (categoryId: string) => void;
}

const SuggestionRow = memo(function SuggestionRow({
  suggestion,
  category,
  isTop,
  confidencePercent,
  getConfidenceColor,
  getConfidenceLabel,
  onApply,
  onReject
}: SuggestionRowProps) {
  const logger = useLogger();
  return (
    <div
      className={`
        flex items-center justify-between gap-3 p-3 rounded-lg border
        ${isTop 
          ? 'border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800' 
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
          onClick={() => onApply(suggestion.categoryId)}
          className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg transition-colors"
          title="Apply this category"
        >
          <CheckIcon size={16} />
        </button>
        <button
          onClick={() => onReject(suggestion.categoryId)}
          className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors"
          title="This is incorrect"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
});

// No suggestions message sub-component
const NoSuggestionsMessage = memo(function NoSuggestionsMessage() {
  return (
    <div className="text-center py-4">
      <AlertCircleIcon size={24} className="text-gray-400 mx-auto mb-2" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No suggestions available. The AI needs more data to learn from your categorization patterns.
      </p>
    </div>
  );
});