import React from 'react';
import {
  BarChart3Icon,
  CreditCardIcon,
  SearchIcon,
  TrendingUpIcon,
  BellIcon,
  ShieldIcon
} from '../icons';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  count?: number;
}

interface DataIntelligenceTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  insightsCount: number;
}

export default function DataIntelligenceTabs({ 
  activeTab, 
  onTabChange, 
  insightsCount 
}: DataIntelligenceTabsProps): React.JSX.Element {
  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3Icon },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCardIcon },
    { id: 'merchants', label: 'Merchants', icon: SearchIcon },
    { id: 'patterns', label: 'Patterns', icon: TrendingUpIcon },
    { id: 'insights', label: 'Insights', icon: BellIcon, count: insightsCount },
    { id: 'verification', label: 'Verification', icon: ShieldIcon }
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === id
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} />
                {label}
                {count !== undefined && count > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}