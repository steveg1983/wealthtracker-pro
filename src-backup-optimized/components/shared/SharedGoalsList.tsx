import React, { useEffect, memo } from 'react';
import { format } from 'date-fns';
import { PlusIcon, CheckIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { SharedGoal } from '../../services/sharedFinanceService';
import type { HouseholdMember } from '../../services/householdService';
import { useLogger } from '../services/ServiceProvider';

interface SharedGoalsListProps {
  sharedGoals: SharedGoal[];
  householdMembers: HouseholdMember[];
  currentMemberId?: string;
  canEditGoals: boolean;
  onCreateGoal: () => void;
  onContributeToGoal: (goalId: string, amount: number) => void;
}

export const SharedGoalsList = memo(function SharedGoalsList({ sharedGoals,
  householdMembers,
  currentMemberId,
  canEditGoals,
  onCreateGoal,
  onContributeToGoal
 }: SharedGoalsListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SharedGoalsList component initialized', {
      componentName: 'SharedGoalsList'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="space-y-4">
      {/* Create Button */}
      {canEditGoals && (
        <button
          onClick={onCreateGoal}
          className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
        >
          <PlusIcon size={20} />
          Create Shared Goal
        </button>
      )}

      {/* Goals List */}
      {sharedGoals.map(goal => {
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const myContribution = goal.contributors.find(c => c.memberId === currentMemberId);

        return (
          <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{goal.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {goal.description}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                </p>
                <p className={`text-sm ${daysLeft < 30 ? 'text-orange-600' : 'text-gray-600'}`}>
                  {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    goal.completedAt ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(0)}% complete</p>
            </div>

            {/* Contributors */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Contributors:</p>
              {goal.contributors.map(contributor => (
                <div key={contributor.memberId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ 
                        backgroundColor: householdMembers.find(m => m.id === contributor.memberId)?.color 
                      }}
                    >
                      {contributor.memberName.charAt(0)}
                    </div>
                    <span>{contributor.memberName}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(contributor.currentAmount)} / {formatCurrency(contributor.targetAmount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((contributor.currentAmount / contributor.targetAmount) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Contribute */}
            {!goal.completedAt && myContribution && canEditGoals && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map(amount => (
                    <button
                      key={amount}
                      onClick={() => onContributeToGoal(goal.id, amount)}
                      className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 text-sm"
                    >
                      +${amount}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {goal.completedAt && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                  <CheckIcon size={16} className="inline mr-1" />
                  Goal achieved on {format(goal.completedAt!, 'MMM d, yyyy')}!
                </p>
              </div>
            )}
          </div>
        );
      })}

      {sharedGoals.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No shared goals yet
        </div>
      )}
    </div>
  );
});