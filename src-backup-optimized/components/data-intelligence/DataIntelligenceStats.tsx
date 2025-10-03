import React from 'react';
import {
  SearchIcon,
  CreditCardIcon,
  TrendingUpIcon,
  BellIcon
} from '../icons';
import type { Subscription, SpendingInsight } from '../../services/dataIntelligenceService';

type StatsType = {
  totalMerchants: number;
  enrichedMerchants: number;
  categoryAccuracy: number;
  activeSubscriptions: number;
  monthlySubscriptionCost: number;
  patternsDetected: number;
};

interface DataIntelligenceStatsProps {
  stats: StatsType;
  detectedSubscriptions: Subscription[];
  insights: SpendingInsight[];
  formatCurrency: (amount: number) => string;
}

export default function DataIntelligenceStats({
  stats,
  detectedSubscriptions,
  insights,
  formatCurrency
}: DataIntelligenceStatsProps): React.JSX.Element {
  const statsCards = [
    {
      title: 'Total Merchants',
      value: stats.totalMerchants > 0 ? stats.totalMerchants : '-',
      subtitle: stats.totalMerchants > 0 
        ? `${stats.enrichedMerchants} enriched (${stats.categoryAccuracy.toFixed(1)}%)`
        : 'No merchants detected yet',
      icon: SearchIcon,
      color: 'gray'
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions + detectedSubscriptions.length,
      subtitle: detectedSubscriptions.length > 0 
        ? `${detectedSubscriptions.length} detected`
        : stats.monthlySubscriptionCost > 0 
          ? `${formatCurrency(stats.monthlySubscriptionCost)}/month`
          : 'No subscriptions found',
      icon: CreditCardIcon,
      color: 'green'
    },
    {
      title: 'Patterns Detected',
      value: stats.patternsDetected,
      subtitle: 'Spending patterns',
      icon: TrendingUpIcon,
      color: 'purple'
    },
    {
      title: 'Active Insights',
      value: insights.length,
      subtitle: 'Actionable insights',
      icon: BellIcon,
      color: 'orange'
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      gray: 'text-gray-600 dark:text-gray-500',
      green: 'text-green-600 dark:text-green-400',
      purple: 'text-purple-600 dark:text-purple-400',
      orange: 'text-orange-600 dark:text-orange-400'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  };

  const getIconColorClasses = (color: string) => {
    const colorMap = {
      gray: 'text-gray-500',
      green: 'text-green-500',
      purple: 'text-purple-500',
      orange: 'text-orange-500'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsCards.map((card) => (
        <div key={card.title} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{card.title}</p>
              <p className={`text-2xl font-bold ${getColorClasses(card.color)}`}>
                {card.value}
              </p>
            </div>
            <card.icon size={24} className={getIconColorClasses(card.color)} />
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {card.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}
