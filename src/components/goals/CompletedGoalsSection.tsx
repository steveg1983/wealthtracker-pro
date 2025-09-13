import React, { useEffect, memo } from 'react';
import { EditIcon, DeleteIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import type { Goal } from '../../types';
import { logger } from '../../services/loggingService';

interface CompletedGoalsSectionProps {
  completedGoals: Goal[];
  getGoalIcon: (type: Goal['type']) => string;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

const CompletedGoalsSection = memo(function CompletedGoalsSection({
  completedGoals,
  getGoalIcon,
  onEdit,
  onDelete
}: CompletedGoalsSectionProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('CompletedGoalsSection component initialized', {
      componentName: 'CompletedGoalsSection'
    });
  }, []);
  if (completedGoals.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Completed Goals</h2>
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {completedGoals.map((goal) => (
            <div key={goal.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl opacity-50">{getGoalIcon(goal.type)}</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{goal.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Completed " �{goal.targetAmount.toLocaleString('en-GB', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
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
          ))}
        </div>
      </div>
    </div>
  );
});

export default CompletedGoalsSection;
