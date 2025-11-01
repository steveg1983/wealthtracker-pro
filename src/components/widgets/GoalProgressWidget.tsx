import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { TargetIcon, TrendingUpIcon, CheckCircleIcon } from '../icons';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import type { BaseWidgetProps } from '../../types/widget-types';

type GoalProgressWidgetProps = BaseWidgetProps;

export default function GoalProgressWidget({ size = 'medium' }: GoalProgressWidgetProps) {
  const { goals } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const activeGoals = useMemo(() => {
    return goals.filter(goal => !goal.achieved).slice(0, size === 'small' ? 2 : size === 'medium' ? 3 : 5);
  }, [goals, size]);

  const totalProgress = useMemo(() => {
    if (activeGoals.length === 0) return 0;
    const sum = activeGoals.reduce((acc, goal) => acc + (goal.progress || 0), 0);
    return Math.round(sum / activeGoals.length);
  }, [activeGoals]);

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <TargetIcon size={48} className="mb-2 opacity-50" />
        <p className="text-sm">No goals set</p>
        <a href="/goals" className="text-xs text-primary hover:underline mt-1">
          Set your first goal
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalProgress}%
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Average Progress
          </p>
        </div>
        <div className="w-16 h-16">
          <CircularProgressbar
            value={totalProgress}
            text={`${totalProgress}%`}
            styles={buildStyles({
              textSize: '24px',
              pathColor: `var(--color-primary)`,
              textColor: 'var(--color-text)',
              trailColor: 'var(--color-background-secondary)',
            })}
          />
        </div>
      </div>

      {/* Goals List */}
      <div className={`space-y-3 ${size === 'large' ? 'max-h-64 overflow-y-auto' : ''}`}>
        {activeGoals.map((goal) => (
          <div
            key={goal.id}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                {goal.name}
              </h4>
              {(goal.progress || 0) >= 100 ? (
                <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
              ) : (
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {goal.progress || 0}%
                </span>
              )}
            </div>
            
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>{formatCurrency(goal.currentAmount)}</span>
                <span>{formatCurrency(goal.targetAmount)}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
                />
              </div>
            </div>

            {goal.targetDate && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Target: {new Date(goal.targetDate).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* View All Link */}
      <div className="text-center pt-2">
        <a
          href="/goals"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          View all goals
          <TrendingUpIcon size={14} />
        </a>
      </div>
    </div>
  );
}
