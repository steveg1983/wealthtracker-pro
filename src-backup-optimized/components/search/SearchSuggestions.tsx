/**
 * Search Suggestions Component
 * Dropdown suggestions for search input
 */

import React, { useEffect, memo } from 'react';
import { ClockIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface SearchSuggestionsProps {
  suggestions: string[];
  selectedIndex: number;
  onSelect: (suggestion: string) => void;
}

export const SearchSuggestions = memo(function SearchSuggestions({ suggestions,
  selectedIndex,
  onSelect
 }: SearchSuggestionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SearchSuggestions component initialized', {
      componentName: 'SearchSuggestions'
    });
  }, []);

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
            index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
          }`}
          aria-label={`Select suggestion: ${suggestion}`}
        >
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 dark:text-white">{suggestion}</span>
          </div>
        </button>
      ))}
    </div>
  );
});