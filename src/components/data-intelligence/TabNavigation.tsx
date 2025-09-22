import React, { useEffect, memo } from 'react';
import { 
  BarChart3Icon,
  CreditCardIcon,
  SearchIcon,
  TrendingUpIcon,
  BellIcon,
  ShieldIcon
} from '../icons';
import type { ActiveTab } from '../../services/dataIntelligencePageService';
import { useLogger } from '../services/ServiceProvider';

interface TabNavigationProps {
  activeTab: ActiveTab;
  insightCount: number;
  onTabChange: (tab: ActiveTab) => void;
}

interface TabConfig {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
  showBadge?: boolean;
}

const TabNavigation = memo(function TabNavigation({ activeTab,
  insightCount,
  onTabChange
 }: TabNavigationProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TabNavigation component initialized', {
      componentName: 'TabNavigation'
    });
  }, []);

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3Icon size={16} /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCardIcon size={16} /> },
    { id: 'merchants', label: 'Merchants', icon: <SearchIcon size={16} /> },
    { id: 'patterns', label: 'Patterns', icon: <TrendingUpIcon size={16} /> },
    { id: 'insights', label: 'Insights', icon: <BellIcon size={16} />, showBadge: true },
    { id: 'verification', label: 'Verification', icon: <ShieldIcon size={16} /> }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
                {tab.showBadge && insightCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {insightCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
});

export default TabNavigation;