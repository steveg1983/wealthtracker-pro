import React, { useEffect, memo } from 'react';
import { FilterRenderer } from './FilterRenderer';
import type { SearchFilter } from './types';
import { logger } from '../../services/loggingService';

interface AdvancedFiltersProps {
  filters: SearchFilter[];
  onUpdateFilter: (filterId: string, value: string | string[] | number | boolean | null) => void;
  searchName: string;
  onSearchNameChange: (name: string) => void;
  onSaveSearch: () => void;
  hasActiveFilters: boolean;
}

export const AdvancedFilters = memo(function AdvancedFilters({
  filters,
  onUpdateFilter,
  searchName,
  onSearchNameChange,
  onSaveSearch,
  hasActiveFilters
}: AdvancedFiltersProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AdvancedFilters component initialized', {
      componentName: 'AdvancedFilters'
    });
  }, []);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filters.map(filter => (
          <div key={filter.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {filter.label}
            </label>
            <FilterRenderer filter={filter} onUpdate={onUpdateFilter} />
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <input
          type="text"
          value={searchName}
          onChange={(e) => onSearchNameChange(e.target.value)}
          placeholder="Search name..."
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={onSaveSearch}
          disabled={!searchName.trim() || !hasActiveFilters}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Save Search
        </button>
      </div>
    </div>
  );
});