import { memo, useEffect } from 'react';
import type { ComponentType } from 'react';
import type { DataManagementTab } from '../../services/dataManagementPageService';
import { logger } from '../../services/loggingService';
import type { IconProps } from '../icons';
import {
  DatabaseIcon,
  UploadIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  SettingsIcon,
  RefreshCwIcon
} from '../icons';

interface TabNavigationProps {
  activeTab: DataManagementTab;
  tabConfigs: Array<{
    id: DataManagementTab;
    label: string;
    icon: string;
    description: string;
  }>;
  onTabChange: (tab: DataManagementTab) => void;
}

// Create icon map for data management tabs
const iconMap: Record<string, ComponentType<IconProps>> = {
  DatabaseIcon,
  UploadIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  SettingsIcon,
  RefreshCwIcon
};

export const TabNavigation = memo(function TabNavigation({
  activeTab,
  tabConfigs,
  onTabChange
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
        <nav className="flex space-x-8 overflow-x-auto">
          {tabConfigs.map((tab) => {
            const Icon = iconMap[tab.icon] || DatabaseIcon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-gray-600 text-gray-600 dark:border-gray-400 dark:text-gray-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} />
                  {tab.label}
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
});