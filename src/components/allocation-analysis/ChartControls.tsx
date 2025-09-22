import React, { useEffect, memo } from 'react';
import {
  PieChartIcon,
  BarChart3Icon,
  TrendingUpIcon,
  TargetIcon,
  DownloadIcon
} from '../icons';
import type { ViewMode, GroupBy } from './types';
import { useLogger } from '../services/ServiceProvider';

interface ChartControlsProps {
  viewMode: ViewMode;
  groupBy: GroupBy;
  showTargets: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onToggleTargets: () => void;
  onExport: () => void;
}

export const ChartControls = memo(function ChartControls({ viewMode,
  groupBy,
  showTargets,
  onViewModeChange,
  onGroupByChange,
  onToggleTargets,
  onExport
 }: ChartControlsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ChartControls component initialized', {
      componentName: 'ChartControls'
    });
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewModeChange('pie')}
          className={`p-2 rounded-lg transition-colors ${
            viewMode === 'pie' 
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Pie Chart"
        >
          <PieChartIcon size={20} />
        </button>
        <button
          onClick={() => onViewModeChange('bar')}
          className={`p-2 rounded-lg transition-colors ${
            viewMode === 'bar' 
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Bar Chart"
        >
          <BarChart3Icon size={20} />
        </button>
        <button
          onClick={() => onViewModeChange('treemap')}
          className={`p-2 rounded-lg transition-colors ${
            viewMode === 'treemap' 
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Treemap"
        >
          <TrendingUpIcon size={20} />
        </button>
        
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
        
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
          className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        >
          <option value="assetClass">Asset Class</option>
          <option value="account">Account</option>
          <option value="symbol">Symbol</option>
        </select>
        
        {groupBy === 'assetClass' && (
          <button
            onClick={onToggleTargets}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showTargets 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <TargetIcon size={16} />
            Targets
          </button>
        )}
      </div>
      
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
      >
        <DownloadIcon size={16} />
        Export
      </button>
    </div>
  );
});