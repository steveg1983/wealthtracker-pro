import React from 'react';
import { TrendingUpIcon, ChartBarIcon, PdfIcon } from '../icons';
import type { ActiveTab } from '../../services/reportsPageService';

interface ReportTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export default function ReportTabs({
  activeTab,
  onTabChange
}: ReportTabsProps): React.JSX.Element {
  const tabs = [
    { id: 'overview' as ActiveTab, label: 'Overview', icon: TrendingUpIcon },
    { id: 'budget' as ActiveTab, label: 'Budget Comparison', icon: ChartBarIcon },
    { id: 'generator' as ActiveTab, label: 'Report Generator', icon: PdfIcon }
  ];

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-1 mb-6">
      <div className="flex space-x-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === id
                ? 'bg-gray-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}