/**
 * @component Header
 * @description Merchant enrichment header with title and refresh action
 */

import { memo, useEffect } from 'react';
import { RefreshCwIcon } from '../icons';
import type { HeaderProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const Header = memo(function Header({ onRefresh, 
  isRefreshing = false,
  totalCount = 0 
 }: HeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('Header component initialized', {
      componentName: 'Header'
    });
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Merchant Enrichment
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {totalCount > 0 
            ? `Manage and enrich ${totalCount} merchant${totalCount !== 1 ? 's' : ''}`
            : 'Intelligent categorization and data enrichment'
          }
        </p>
      </div>
      
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
          transition-colors ${
            isRefreshing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }
        `}
        aria-label="Refresh merchant data"
      >
        <RefreshCwIcon 
          size={16} 
          className={isRefreshing ? 'animate-spin' : ''} 
        />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
});