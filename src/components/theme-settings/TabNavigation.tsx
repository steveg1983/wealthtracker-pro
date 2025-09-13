import React, { useEffect, memo } from 'react';
import { ClockIcon, PaletteIcon, SettingsIcon } from '../icons';
import type { ActiveTab } from '../../services/themeSettingsPageService';
import { logger } from '../../services/loggingService';

interface TabNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  getTabButtonClass: (isActive: boolean) => string;
  schedulesCount: number;
  presetsCount: number;
}

const TabNavigation = memo(function TabNavigation({
  activeTab,
  onTabChange,
  getTabButtonClass,
  schedulesCount,
  presetsCount
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
          <button
            onClick={() => onTabChange('schedules')}
            className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${getTabButtonClass(activeTab === 'schedules')}`}
          >
            <div className="flex items-center gap-2">
              <ClockIcon size={16} />
              Schedules ({schedulesCount})
            </div>
          </button>
          <button
            onClick={() => onTabChange('presets')}
            className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${getTabButtonClass(activeTab === 'presets')}`}
          >
            <div className="flex items-center gap-2">
              <PaletteIcon size={16} />
              Presets ({presetsCount})
            </div>
          </button>
          <button
            onClick={() => onTabChange('settings')}
            className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${getTabButtonClass(activeTab === 'settings')}`}
          >
            <div className="flex items-center gap-2">
              <SettingsIcon size={16} />
              Advanced
            </div>
          </button>
        </nav>
      </div>
    </div>
  );
});

export default TabNavigation;