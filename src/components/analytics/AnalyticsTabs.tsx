/**
 * Analytics Tabs Component
 * Tab navigation for analytics sections
 */

import React, { useEffect } from 'react';
import { 
  LightbulbIcon,
  AlertTriangleIcon, 
  TrendingUpIcon, 
  PiggyBankIcon
} from '../icons';
import type { TabType } from '../../services/advancedAnalyticsComponentService';
import { logger } from '../../services/loggingService';

interface AnalyticsTabsProps {
  activeTab: TabType;
  counts: {
    insights: number;
    anomalies: number;
    predictions: number;
    opportunities: number;
  };
  onTabChange: (tab: TabType) => void;
}

const AnalyticsTabs = React.memo(({
  activeTab,
  counts,
  onTabChange
}: AnalyticsTabsProps) => {
  const tabs = [
    { id: 'insights' as TabType, label: 'Insights', icon: LightbulbIcon, count: counts.insights },
    { id: 'anomalies' as TabType, label: 'Anomalies', icon: AlertTriangleIcon, count: counts.anomalies },
    { id: 'predictions' as TabType, label: 'Predictions', icon: TrendingUpIcon, count: counts.predictions },
    { id: 'opportunities' as TabType, label: 'Opportunities', icon: PiggyBankIcon, count: counts.opportunities }
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <Icon className="mr-2 h-5 w-5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
});

AnalyticsTabs.displayName = 'AnalyticsTabs';

export default AnalyticsTabs;