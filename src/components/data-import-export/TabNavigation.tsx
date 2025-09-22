import { memo, useEffect } from 'react';
import { UploadIcon, DownloadIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface TabNavigationProps {
  activeTab: 'import' | 'export';
  onTabChange: (tab: 'import' | 'export') => void;
}

/**
 * Tab navigation component
 * Switches between import and export tabs
 */
export const TabNavigation = memo(function TabNavigation({ activeTab,
  onTabChange
 }: TabNavigationProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TabNavigation component initialized', {
      componentName: 'TabNavigation'
    });
  }, []);

  return (
    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
      <TabButton
        active={activeTab === 'import'}
        icon={UploadIcon}
        label="Import Data"
        onClick={() => onTabChange('import')}
      />
      <TabButton
        active={activeTab === 'export'}
        icon={DownloadIcon}
        label="Export Data"
        onClick={() => onTabChange('export')}
      />
    </div>
  );
});

/**
 * Individual tab button component
 */
const TabButton = memo(function TabButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
});