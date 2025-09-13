import React, { useEffect, memo } from 'react';
import { TargetIcon, TrendingUpIcon } from '../icons';
import type { GoalStats } from '../../services/goalsPageService';
import { logger } from '../../services/loggingService';

interface GoalsSummaryCardsProps {
  stats: GoalStats;
  formatCurrency: (value: number) => string;
}

const GoalsSummaryCards = memo(function GoalsSummaryCards({
  stats,
  formatCurrency
}: GoalsSummaryCardsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('GoalsSummaryCards component initialized', {
      componentName: 'GoalsSummaryCards'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <SummaryCard
        label="Active Goals"
        value={stats.activeCount.toString()}
        icon={<TargetIcon className="h-8 w-8 text-gray-600" />}
      />

      <SummaryCard
        label="Total Target"
        value={formatCurrency(stats.totalTargetAmount.toNumber())}
        icon={<TrendingUpIcon className="h-8 w-8 text-green-600" />}
      />

      <SummaryCard
        label="Total Saved"
        value={formatCurrency(stats.totalCurrentAmount.toNumber())}
        icon={
          <div className="relative h-8 w-8">
            <svg className="h-8 w-8 transform -rotate-90">
              <circle cx="16" cy="16" r="14" stroke="#e5e7eb" strokeWidth="4" fill="none" />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="#3b82f6"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${stats.overallProgress * 0.88} 88`}
              />
            </svg>
          </div>
        }
      />

      <SummaryCard
        label="Completed"
        value={stats.completedCount.toString()}
        icon={<div className="text-2xl">✅</div>}
      />
    </div>
  );
});

const SummaryCard = memo(function SummaryCard({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
});

export default GoalsSummaryCards;
