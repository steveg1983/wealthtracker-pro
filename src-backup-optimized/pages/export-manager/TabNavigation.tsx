import { memo } from 'react';
import { DownloadIcon, FileTextIcon, ClockIcon, CalendarIcon } from '../../components/icons';
import type { ActiveTab } from './types';

interface TabNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  templateCount: number;
  activeReportCount: number;
}

/**
 * Navigation tabs for export manager
 * Switches between export, templates, scheduled, and history views
 */
export const TabNavigation = memo(function TabNavigation({
  activeTab,
  setActiveTab,
  templateCount,
  activeReportCount
}: TabNavigationProps) {
  const tabs = [
    {
      id: 'export' as ActiveTab,
      label: 'Quick Export',
      icon: DownloadIcon,
      count: null
    },
    {
      id: 'templates' as ActiveTab,
      label: 'Templates',
      icon: FileTextIcon,
      count: templateCount
    },
    {
      id: 'scheduled' as ActiveTab,
      label: 'Scheduled',
      icon: ClockIcon,
      count: activeReportCount
    },
    {
      id: 'history' as ActiveTab,
      label: 'History',
      icon: CalendarIcon,
      count: null
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} />
                  {tab.label}
                  {tab.count !== null && (
                    <span className="ml-1 text-xs">({tab.count})</span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
});