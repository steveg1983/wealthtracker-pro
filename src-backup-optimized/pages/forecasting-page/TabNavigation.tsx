import { memo } from 'react';
import { BanknoteIcon, LineChartIcon, CalendarIcon } from '../../components/icons';
import type { ActiveTab, BudgetSubTab } from './types';

interface TabNavigationProps {
  activeTab: ActiveTab;
  budgetSubTab: BudgetSubTab;
  onTabChange: (tab: ActiveTab) => void;
  onBudgetSubTabChange: (tab: BudgetSubTab) => void;
}

/**
 * Navigation component for main tabs and budget sub-tabs
 */
export const TabNavigation = memo(function TabNavigation({
  activeTab,
  budgetSubTab,
  onTabChange,
  onBudgetSubTabChange
}: TabNavigationProps) {
  return (
    <>
      {/* Main Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => onTabChange('budget')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'budget'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BanknoteIcon size={16} />
          Budget
        </button>
        <button
          onClick={() => onTabChange('forecast')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'forecast'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LineChartIcon size={16} />
          Forecast
        </button>
        <button
          onClick={() => onTabChange('seasonal')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'seasonal'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CalendarIcon size={16} />
          Seasonal Trends
        </button>
      </div>

      {/* Budget Sub-tabs */}
      {activeTab === 'budget' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { id: 'traditional' as const, label: 'Traditional' },
            { id: 'envelope' as const, label: 'Envelope' },
            { id: 'templates' as const, label: 'Templates' },
            { id: 'rollover' as const, label: 'Rollover' },
            { id: 'alerts' as const, label: 'Alerts' },
            { id: 'zero-based' as const, label: 'Zero-Based' }
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => onBudgetSubTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
});