/**
 * Pattern Filters Component
 * Handles filtering and sorting of patterns
 */

import React, { useEffect } from 'react';
import { FilterIcon } from '../icons';
import type { SortOption } from '../../services/spendingPatternsService';
import { useLogger } from '../services/ServiceProvider';

interface PatternFiltersProps {
  selectedType: string;
  selectedCategory: string;
  sortBy: SortOption;
  patternTypes: string[];
  categories: string[];
  onTypeChange: (type: string) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: SortOption) => void;
}

const PatternFilters = React.memo(({
  selectedType,
  selectedCategory,
  sortBy,
  patternTypes,
  categories,
  onTypeChange,
  onCategoryChange,
  onSortChange
}: PatternFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <FilterIcon size={16} className="text-gray-400" />
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          {patternTypes.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="confidence">Confidence</option>
          <option value="amount">Amount</option>
          <option value="detectedAt">Detected Date</option>
          <option value="frequency">Frequency</option>
        </select>
      </div>
    </div>
  );
});

PatternFilters.displayName = 'PatternFilters';

export default PatternFilters;