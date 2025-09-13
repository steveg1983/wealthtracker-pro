import React, { useEffect, memo } from 'react';
import { TargetIcon, TrendingUpIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface GoalProgress {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  progress: number;
  monthlyRequired: number;
  isOnTrack: boolean;
  target_date?: string;
}

interface GoalsProgressCardProps {
  goals: GoalProgress[];
  formatCurrency: (value: number) => string;
  formatDate: (date: string | Date) => string;
  t: (key: string, defaultValue: string) => string;
  onNavigate?: () => void;
}

export const GoalsProgressCard = memo(function GoalsProgressCard({
  goals,
  formatCurrency,
  formatDate,
  t,
  onNavigate
}: GoalsProgressCardProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('GoalsProgressCard component initialized', {
      componentName: 'GoalsProgressCard'
    });
  }, []);

  if (goals.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <TargetIcon size={20} className="text-gray-500" />
        {t('dashboard.goalsProgress', 'Goals Progress')}
      </h3>

      <div className="space-y-4">
        {goals.slice(0, 3).map(goal => (
          <div key={goal.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {goal.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium ${
                  goal.isOnTrack 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {goal.progress.toFixed(0)}%
                </span>
                {goal.target_date && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('dashboard.by', 'by')} {formatDate(goal.target_date)}
                  </p>
                )}
              </div>
            </div>
            
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  goal.isOnTrack 
                    ? 'bg-green-500' 
                    : goal.progress > 50 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, goal.progress)}%` }}
              />
            </div>

            {goal.monthlyRequired > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <TrendingUpIcon size={14} />
                {t('dashboard.needMonthly', 'Need')} {formatCurrency(goal.monthlyRequired)} {t('dashboard.perMonth', 'per month')}
              </p>
            )}
          </div>
        ))}
      </div>

      {goals.length > 3 && onNavigate && (
        <button 
          onClick={onNavigate}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('dashboard.viewAllGoals', 'View all goals')} →
        </button>
      )}
    </div>
  );
});
