import React, { useEffect, memo } from 'react';
import { StarIcon, TrashIcon, ClockIcon } from '../icons';
import type { SavedSearch } from './types';
import { useLogger } from '../services/ServiceProvider';

interface SavedSearchesProps {
  savedSearches: SavedSearch[];
  onSelect: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  showSavedSearches: boolean;
}

export const SavedSearches = memo(function SavedSearches({ savedSearches,
  onSelect,
  onDelete,
  showSavedSearches
 }: SavedSearchesProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('SavedSearches component initialized', {
      componentName: 'SavedSearches'
    });
  }, []);

  if (!showSavedSearches || savedSearches.length === 0) return null;

  // Sort by usage count and date
  const sortedSearches = [...savedSearches].sort((a, b) => {
    if (b.usageCount !== a.usageCount) {
      return b.usageCount - a.usageCount;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 
                  dark:border-gray-700 p-4">
      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <StarIcon size={18} className="text-yellow-500" />
        Saved Searches
      </h3>
      
      <div className="space-y-2">
        {sortedSearches.map(search => (
          <div
            key={search.id}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 
                     rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <button
              onClick={() => onSelect(search)}
              className="flex-1 text-left"
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">
                {search.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {search.query && <span>Search: "{search.query}"</span>}
                {search.filters.categories?.length && (
                  <span className="ml-2">• {search.filters.categories.length} categories</span>
                )}
                {search.filters.accounts?.length && (
                  <span className="ml-2">• {search.filters.accounts.length} accounts</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <ClockIcon size={12} />
                  {new Date(search.createdAt).toLocaleDateString()}
                </span>
                <span>Used {search.usageCount} times</span>
              </div>
            </button>
            
            <button
              onClick={() => onDelete(search.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete saved search"
            >
              <TrashIcon size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
