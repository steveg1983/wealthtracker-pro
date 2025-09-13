import React, { useEffect, memo } from 'react';
import type { ActiveTab } from '../../services/financialPlanningPageService';
import { logger } from '../../services/loggingService';

interface TabNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  getTabButtonClass: (isActive: boolean) => string;
}

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tax', label: 'Tax Calculator' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'debt', label: 'Debt Payoff' },
  { id: 'goals', label: 'Goals' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'networth', label: 'Net Worth' }
];

const TabNavigation = memo(function TabNavigation({
  activeTab,
  onTabChange,
  getTabButtonClass
}: TabNavigationProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TabNavigation component initialized', {
      componentName: 'TabNavigation'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex justify-center gap-8 px-6 py-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={getTabButtonClass(activeTab === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
});

export default TabNavigation;