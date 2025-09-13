import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, ChartBarIcon, PdfIcon } from '../icons';
import type { ActiveTab } from '../../services/reportsPageService';
import { logger } from '../../services/loggingService';

interface TabNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const TabNavigation = memo(function TabNavigation({
  activeTab,
  onTabChange
}: TabNavigationProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TabNavigation component initialized', {
      componentName: 'TabNavigation'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-1 mb-6">
      <div className="flex space-x-1">
        <button
          onClick={() => onTabChange('overview')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-gray-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <TrendingUpIcon size={20} />
          Overview
        </button>
        <button
          onClick={() => onTabChange('budget')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'budget'
              ? 'bg-gray-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <ChartBarIcon size={20} />
          Budget Comparison
        </button>
        <button
          onClick={() => onTabChange('generator')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'generator'
              ? 'bg-gray-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <PdfIcon size={20} />
          Report Generator
        </button>
      </div>
    </div>
  );
});

export default TabNavigation;