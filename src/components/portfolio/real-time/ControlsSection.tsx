/**
 * @component ControlsSection
 * @description Portfolio controls for search, sort, and refresh functionality
 */

import { memo, useEffect } from 'react';
import { SearchIcon, RefreshCwIcon, SortIcon } from '../../icons';
import type { ControlsSectionProps, SortBy } from './types';
import { logger } from '../../../services/loggingService';

export const ControlsSection = memo(function ControlsSection({
  searchQuery,
  sortBy,
  isRefreshing,
  onSearchChange,
  onSortChange,
  onRefresh
}: ControlsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ControlsSection component initialized', {
      componentName: 'ControlsSection'
    });
  }, []);

  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-3">
      <div className="flex-1 relative">
        <SearchIcon 
          size={20} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search holdings..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        />
      </div>
      
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortBy)}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
      >
        <option value="value">Sort by Value</option>
        <option value="symbol">Sort by Symbol</option>
        <option value="gain">Sort by Gain/Loss</option>
        <option value="dayChange">Sort by Day Change</option>
        <option value="allocation">Sort by Allocation</option>
      </select>
      
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
          isRefreshing 
            ? 'bg-gray-300 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <RefreshCwIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  );
});