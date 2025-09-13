/**
 * @component FilterSection
 * @description Search, filter and sort controls for merchant list
 */

import { memo, useCallback, useEffect } from 'react';
import { SearchIcon, FilterIcon, SortIcon } from '../icons';
import type { FilterSectionProps, SortOption } from './types';
import { logger } from '../../services/loggingService';

export const FilterSection = memo(function FilterSection({
  searchTerm,
  selectedCategory,
  sortBy,
  categories,
  onSearchChange,
  onCategoryChange,
  onSortChange
}: FilterSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('FilterSection component initialized', {
      componentName: 'FilterSection'
    });
  }, []);

  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onCategoryChange(e.target.value);
  }, [onCategoryChange]);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value as SortOption);
  }, [onSortChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {/* Search Input */}
      <div className="flex-1 relative">
        <SearchIcon 
          size={20} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search merchants..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search merchants"
        />
      </div>
      
      {/* Category Filter */}
      <div className="relative">
        <FilterIcon 
          size={16} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <select
          value={selectedCategory}
          onChange={handleCategoryChange}
          className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     appearance-none cursor-pointer
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Filter by category"
        >
          <option value="all">All Categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      
      {/* Sort Options */}
      <div className="relative">
        <SortIcon 
          size={16} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <select
          value={sortBy}
          onChange={handleSortChange}
          className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     appearance-none cursor-pointer
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Sort merchants"
        >
          <option value="confidence">Sort by Confidence</option>
          <option value="name">Sort by Name</option>
          <option value="frequency">Sort by Frequency</option>
          <option value="lastUpdated">Sort by Last Updated</option>
        </select>
      </div>
    </div>
  );
});