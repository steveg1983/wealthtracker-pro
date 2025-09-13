import { memo, useEffect } from 'react';
import { SearchIcon, ClockIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface SearchHeaderProps {
  resultsCount: number;
  query: string;
  loading: boolean;
}

export const SearchHeader = memo(function SearchHeader({
  resultsCount,
  query,
  loading
}: SearchHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SearchHeader component initialized', {
      componentName: 'SearchHeader'
    });
  }, []);

  return (
    <div className="px-4 py-3 bg-blue-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SearchIcon size={18} className="text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {resultsCount} results for "{query}"
          </span>
        </div>
        
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClockIcon size={14} className="animate-spin" />
            Searching...
          </div>
        )}
      </div>
    </div>
  );
});