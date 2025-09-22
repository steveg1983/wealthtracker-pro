import { memo, useEffect } from 'react';
import { RefreshCwIcon, FilterIcon, SortIcon, EyeIcon, EyeOffIcon } from '../icons';
import { DataInsightsService } from '../../services/dataInsightsService';
import { useLogger } from '../services/ServiceProvider';

interface InsightsHeaderProps {
  filter: 'all' | 'high' | 'medium' | 'low';
  typeFilter: string;
  sortBy: 'createdAt' | 'severity' | 'category';
  showDismissed: boolean;
  onFilterChange: (filter: 'all' | 'high' | 'medium' | 'low') => void;
  onTypeFilterChange: (type: string) => void;
  onSortChange: (sort: 'createdAt' | 'severity' | 'category') => void;
  onToggleDismissed: () => void;
  onRefresh: () => void;
}

export const InsightsHeader = memo(function InsightsHeader({ filter,
  typeFilter,
  sortBy,
  showDismissed,
  onFilterChange,
  onTypeFilterChange,
  onSortChange,
  onToggleDismissed,
  onRefresh
 }: InsightsHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InsightsHeader component initialized', {
      componentName: 'InsightsHeader'
    });
  }, []);

  const availableTypes = DataInsightsService.getAvailableTypes();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Data Insights
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered analysis of your financial data
          </p>
        </div>
        
        <button
          onClick={onRefresh}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh insights"
        >
          <RefreshCwIcon size={20} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <FilterIcon size={16} className="text-gray-400" />
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as 'all' | 'high' | 'medium' | 'low')}
            className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            {availableTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <SortIcon size={16} className="text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'createdAt' | 'severity' | 'category')}
            className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="createdAt">Most Recent</option>
            <option value="severity">Severity</option>
            <option value="category">Category</option>
          </select>
        </div>

        <button
          onClick={onToggleDismissed}
          className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors ${
            showDismissed 
              ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
          }`}
        >
          {showDismissed ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
          {showDismissed ? 'Hide' : 'Show'} Dismissed
        </button>
      </div>
    </div>
  );
});