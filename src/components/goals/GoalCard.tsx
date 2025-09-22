import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import {
  EditIcon,
  TrashIcon,
  TrendingUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  DollarSignIcon,
  TargetIcon,
  PiggyBankIcon,
  HomeIcon,
  CarIcon,
  GraduationCapIcon,
  PalmtreeIcon,
  RingIcon,
  HeartIcon
} from '../icons';
import type { Goal } from '../../types';
import type { GoalProjection } from './types';
import { CATEGORY_COLORS } from './types';
import { useLogger } from '../services/ServiceProvider';

interface GoalCardProps {
  goal: Goal;
  projection: GoalProjection;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onUpdateProgress: (goal: Goal, newAmount: number) => void;
}

const getGoalIcon = (category?: string) => {
  switch (category) {
    case 'home': return HomeIcon;
    case 'car': return CarIcon;
    case 'education': return GraduationCapIcon;
    case 'vacation': return PalmtreeIcon;
    case 'wedding': return RingIcon;
    case 'emergency': return HeartIcon;
    case 'retirement': return PiggyBankIcon;
    default: return TargetIcon;
  }
};

export const GoalCard = memo(function GoalCard({ goal,
  projection,
  onEdit,
  onDelete,
  onUpdateProgress
 }: GoalCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('GoalCard component initialized', {
      componentName: 'GoalCard'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();
  const Icon = getGoalIcon(goal.category);
  const categoryStyle = CATEGORY_COLORS[goal.category || 'other'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      {/* Goal Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${categoryStyle}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {goal.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {goal.category || 'Other'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(goal)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-500"
          >
            <EditIcon size={14} />
          </button>
          <button
            onClick={() => onDelete(goal)}
            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatCurrency(goal.currentAmount || 0)}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatCurrency(goal.targetAmount)}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              projection.currentProgress >= 100 
                ? 'bg-green-500' 
                : projection.onTrack 
                  ? 'bg-gray-500' 
                  : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(100, projection.currentProgress)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {projection.currentProgress.toFixed(1)}% complete
        </p>
      </div>

      {/* Goal Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <CalendarIcon size={14} />
            Target Date
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {new Date(goal.targetDate).toLocaleDateString()}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <ClockIcon size={14} />
            Time Remaining
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {projection.monthsToGoal < 999 
              ? `${projection.monthsToGoal} months`
              : 'Calculate savings rate'
            }
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <DollarSignIcon size={14} />
            Monthly Need
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(projection.requiredMonthlySaving)}
          </span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        {projection.currentProgress >= 100 ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircleIcon size={16} />
            <span className="text-sm font-medium">Goal Achieved!</span>
          </div>
        ) : projection.onTrack ? (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-500">
            <TrendingUpIcon size={16} />
            <span className="text-sm font-medium">On Track</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertCircleIcon size={16} />
            <span className="text-sm font-medium">Needs Attention</span>
          </div>
        )}
        
        {/* Quick Update Button */}
        <button
          onClick={() => {
            const newAmount = window.prompt(
              'Update current amount saved:',
              String(goal.currentAmount || 0)
            );
            if (newAmount && !isNaN(Number(newAmount))) {
              onUpdateProgress(goal, Number(newAmount));
            }
          }}
          className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
        >
          Update
        </button>
      </div>
    </div>
  );
});