import React, { useEffect, memo } from 'react';
import { XIcon, MagicWandIcon } from '../icons';
import type { ImportRule } from '../../types/importRules';
import { useLogger } from '../services/ServiceProvider';

interface RuleSuggestionsProps {
  isOpen: boolean;
  suggestions: Partial<ImportRule>[];
  onClose: () => void;
  onApply: (suggestion: Partial<ImportRule>) => void;
}

export const RuleSuggestions = memo(function RuleSuggestions({ isOpen,
  suggestions,
  onClose,
  onApply
 }: RuleSuggestionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RuleSuggestions component initialized', {
      componentName: 'RuleSuggestions'
    });
  }, []);

  if (!isOpen) return <></>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <MagicWandIcon size={20} className="text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Suggested Rules
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {suggestions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={suggestion}
                  onApply={() => onApply(suggestion)}
                />
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            💡 These rules are suggested based on patterns in your recent transactions.
            Review each rule before applying.
          </p>
        </div>
      </div>
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="text-center py-8">
      <MagicWandIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        No suggestions available
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        Import more transactions to generate rule suggestions
      </p>
    </div>
  );
});

interface SuggestionCardProps {
  suggestion: Partial<ImportRule>;
  onApply: () => void;
}

const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onApply
}: SuggestionCardProps) {
  const logger = useLogger();
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {suggestion.name}
          </h4>
          {suggestion.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {suggestion.description}
            </p>
          )}
        </div>
        <button
          onClick={onApply}
          className="ml-3 px-3 py-1 bg-primary text-white rounded-lg hover:bg-secondary text-sm transition-colors"
        >
          Apply
        </button>
      </div>
      
      <div className="mt-3 space-y-2">
        {/* Show conditions */}
        {suggestion.conditions && suggestion.conditions.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Conditions:</span>
            <ul className="mt-1 ml-4 text-gray-600 dark:text-gray-400">
              {suggestion.conditions.map((condition, i) => (
                <li key={i}>
                  • {condition.field} {condition.operator} "{condition.value}"
                  {condition.value2 && ` and "${condition.value2}"`}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Show actions */}
        {suggestion.actions && suggestion.actions.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Actions:</span>
            <ul className="mt-1 ml-4 text-gray-600 dark:text-gray-400">
              {suggestion.actions.map((action, i) => (
                <li key={i}>
                  • {formatActionText(action)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

function formatActionText(action: any): string {
  switch (action.type) {
    case 'set_category':
      return `Set category to ${action.value || 'selected'}`;
    case 'set_account':
      return `Set account to ${action.value || 'selected'}`;
    case 'add_tag':
      return `Add tag "${action.value}"`;
    case 'set_merchant':
      return `Set merchant to "${action.value}"`;
    case 'skip':
      return 'Skip transaction';
    default:
      return action.type;
  }
}