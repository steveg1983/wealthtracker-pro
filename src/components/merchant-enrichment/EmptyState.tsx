/**
 * @component EmptyState
 * @description Empty state display for merchant list
 */

import { memo, useEffect } from 'react';
import { SearchIcon, FilterIcon } from '../icons';
import type { EmptyStateProps } from './types';
import { logger } from '../../services/loggingService';

export const EmptyState = memo(function EmptyState({ 
  searchTerm,
  category,
  onClearFilters
}: EmptyStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyState component initialized', {
      componentName: 'EmptyState'
    });
  }, []);

  
  const hasFilters = !!searchTerm || (category && category !== 'all');
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        {hasFilters ? (
          <SearchIcon size={24} className="text-gray-400" />
        ) : (
          <FilterIcon size={24} className="text-gray-400" />
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {hasFilters ? 'No merchants found' : 'No merchants yet'}
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm mb-4">
        {hasFilters 
          ? `No merchants match your search "${searchTerm || ''}" ${category && category !== 'all' ? `in category "${category}"` : ''}`
          : 'Start by importing transactions to enrich merchant data automatically.'
        }
      </p>
      
      {hasFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
});