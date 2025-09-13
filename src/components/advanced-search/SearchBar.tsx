import React, { useEffect, memo } from 'react';
import { SearchIcon, FilterIcon, XIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import { logger } from '../../services/loggingService';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
  savedSearchesCount: number;
  onShowSavedSearches: () => void;
}

export const SearchBar = memo(function SearchBar({
  searchTerm,
  onSearchChange,
  isExpanded,
  onToggleExpanded,
  hasActiveFilters,
  onClearFilters,
  filteredCount,
  totalCount,
  savedSearchesCount,
  onShowSavedSearches
}: SearchBarProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SearchBar component initialized', {
      componentName: 'SearchBar'
    });
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transactions, accounts, categories..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <IconButton
          onClick={onToggleExpanded}
          icon={<FilterIcon size={20} />}
          variant={hasActiveFilters ? 'primary' : 'ghost'}
          size="md"
          className={hasActiveFilters ? 'text-white' : 'text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}
          title="Advanced filters"
        />
        {hasActiveFilters && (
          <IconButton
            onClick={onClearFilters}
            icon={<XIcon size={20} />}
            variant="ghost"
            size="md"
            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            title="Clear filters"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {filteredCount} of {totalCount} transactions
        </span>
        {savedSearchesCount > 0 && (
          <button
            onClick={onShowSavedSearches}
            className="text-primary hover:text-primary-dark"
          >
            Saved Searches ({savedSearchesCount})
          </button>
        )}
      </div>
    </div>
  );
});