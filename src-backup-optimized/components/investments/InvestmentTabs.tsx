import React, { useEffect, memo } from 'react';
import { BarChart3Icon, EyeIcon, LineChartIcon, TrendingUpIcon, PlusIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

export type InvestmentTab = 'overview' | 'watchlist' | 'portfolio' | 'optimize' | 'manage';

interface InvestmentTabsProps {
  activeTab: InvestmentTab;
  onTabChange: (tab: InvestmentTab) => void;
}

export const InvestmentTabs = memo(function InvestmentTabs({ activeTab,
  onTabChange
 }: InvestmentTabsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InvestmentTabs component initialized', {
      componentName: 'InvestmentTabs'
    });
  }, []);

  const tabs: Array<{ id: InvestmentTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <BarChart3Icon size={16} /> },
    { id: 'watchlist', label: 'Watchlist', icon: <EyeIcon size={16} /> },
    { id: 'portfolio', label: 'Portfolio', icon: <LineChartIcon size={16} /> },
    { id: 'optimize', label: 'Optimize', icon: <TrendingUpIcon size={16} /> },
    { id: 'manage', label: 'Manage', icon: <PlusIcon size={16} /> }
  ];

  return (
    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === tab.id
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
});