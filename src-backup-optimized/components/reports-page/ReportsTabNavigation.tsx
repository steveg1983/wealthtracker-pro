import React from 'react';
import { PieChartIcon, TrendingUpIcon, PdfIcon } from '../icons';

interface ReportsTabNavigationProps {
  activeTab: 'overview' | 'budget' | 'generator';
  onTabChange: (tab: 'overview' | 'budget' | 'generator') => void;
}

export default function ReportsTabNavigation({ 
  activeTab, 
  onTabChange 
}: ReportsTabNavigationProps): React.JSX.Element {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: PieChartIcon },
    { id: 'budget' as const, label: 'Budget Reports', icon: TrendingUpIcon },
    { id: 'generator' as const, label: 'Report Generator', icon: PdfIcon }
  ];

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-2 mb-6">
      <div className="flex gap-2">
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