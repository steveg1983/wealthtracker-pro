import { memo, useEffect } from 'react';
import type { ComponentType } from 'react';
import type { BudgetTab, TabConfig } from '../../services/budgetPageService';
import type { IconProps } from '../../components/icons';
import { logger } from '../../services/loggingService';
import { 
  DollarSignIcon,
  TrendingUpIcon,
  TargetIcon,
  CalendarIcon,
  BarChart3Icon,
  AlertCircleIcon
} from '../../components/icons';

interface BudgetTabNavigationProps {
  activeTab: BudgetTab;
  tabConfigs: TabConfig[];
  onTabChange: (tab: BudgetTab) => void;
  getTabClassName: (isActive: boolean) => string;
}

// Create a properly typed icon map with explicit imports
const iconMap: Record<string, ComponentType<IconProps>> = {
  DollarSignIcon,
  TrendingUpIcon,
  TargetIcon,
  CalendarIcon,
  BarChart3Icon,
  AlertCircleIcon
};

export const BudgetTabNavigation = memo(function BudgetTabNavigation({
  activeTab,
  tabConfigs,
  onTabChange,
  getTabClassName
}: BudgetTabNavigationProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetTabNavigation component initialized', {
      componentName: 'BudgetTabNavigation'
    });
  }, []);

  return (
    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-6">
      {tabConfigs.map((tab) => {
        const Icon = iconMap[tab.icon] || DollarSignIcon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={getTabClassName(activeTab === tab.id)}
            title={tab.tooltip}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
});