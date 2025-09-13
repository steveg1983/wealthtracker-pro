import React, { useEffect, memo } from 'react';
import { CalendarIcon, EditIcon, DeleteIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import type { Goal } from '../../types';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

interface ActiveGoalCardProps {
  goal: Goal;
  progress: number;
  daysRemaining: number;
  linkedBalance: DecimalInstance;
  goalIcon: string;
  formatCurrency: (value: number) => string;
  getProgressColorClass: (progress: number) => string;
  getDaysRemainingColorClass: (days: number) => string;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

const ActiveGoalCard = memo(function ActiveGoalCard({
  goal,
  progress,
  daysRemaining,
  linkedBalance,
  goalIcon,
  formatCurrency,
  getProgressColorClass,
  getDaysRemainingColorClass,
  onEdit,
  onDelete
}: ActiveGoalCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ActiveGoalCard component initialized', {
      componentName: 'ActiveGoalCard'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{goalIcon}</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {goal.type.replace("-", " ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton
            onClick={() => onEdit(goal)}
            icon={<EditIcon size={16} />}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
          />
          <IconButton
            onClick={() => onDelete(goal.id)}
            icon={<DeleteIcon size={16} />}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
          />
        </div>
      </div>

      {goal.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{goal.description}</p>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Progress</span>
            <span className="font-medium text-gray-900 dark:text-white">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColorClass(progress)}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Current</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(goal.currentAmount)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Target</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(goal.targetAmount)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            <span className={getDaysRemainingColorClass(daysRemaining)}>
              {daysRemaining > 0 ? `${daysRemaining} days left` : "Overdue"}
            </span>
          </div>
          {goal.linkedAccountIds && goal.linkedAccountIds.length > 0 && (
            <div className="text-gray-600 dark:text-gray-400">
              Linked: {formatCurrency(linkedBalance.toNumber())}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ActiveGoalCard;
