import { memo } from 'react';
import type { ActiveTab } from './types';

interface TabNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

interface Tab {
  id: ActiveTab;
  label: string;
  description: string;
}

/**
 * Navigation component for switching between analytics tabs
 * Manages tab selection and visual state
 */
export const TabNavigation = memo(function TabNavigation({
  activeTab,
  onTabChange
}: TabNavigationProps) {
  const tabs: Tab[] = [
    {
      id: 'dashboards',
      label: 'Dashboards',
      description: 'Custom dashboard views'
    },
    {
      id: 'explorer',
      label: 'Data Explorer',
      description: 'Query and analyze data'
    },
    {
      id: 'insights',
      label: 'Insights',
      description: 'AI-powered analysis'
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Generate custom reports'
    }
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Analytics tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
              transition-colors duration-200
              ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
});