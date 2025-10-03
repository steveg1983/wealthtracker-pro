import React, { useEffect, memo } from 'react';
import { 
  PieChartIcon, 
  TargetIcon, 
  DollarSignIcon, 
  RefreshCwIcon, 
  ShieldIcon, 
  BarChart3Icon, 
  LeafIcon 
} from '../icons';
import type { TabId, TabConfig } from '../../services/enhancedInvestmentsService';
import { useLogger } from '../services/ServiceProvider';

interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  getTabButtonClass: (isActive: boolean) => string;
}

const TabNavigation = memo(function TabNavigation({ tabs,
  activeTab,
  onTabChange,
  getTabButtonClass
 }: TabNavigationProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TabNavigation component initialized', {
      componentName: 'TabNavigation'
    });
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'PieChartIcon': return PieChartIcon;
      case 'TargetIcon': return TargetIcon;
      case 'DollarSignIcon': return DollarSignIcon;
      case 'RefreshCwIcon': return RefreshCwIcon;
      case 'ShieldIcon': return ShieldIcon;
      case 'BarChart3Icon': return BarChart3Icon;
      case 'LeafIcon': return LeafIcon;
      default: return PieChartIcon;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => {
          const Icon = getIcon(tab.icon);
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                getTabButtonClass(activeTab === tab.id)
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default TabNavigation;