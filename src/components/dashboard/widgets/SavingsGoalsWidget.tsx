import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { TargetIcon, TrendingUpIcon, ClockIcon, CheckCircleIcon } from '../../icons';
import { differenceInDays, addMonths } from 'date-fns';

interface SavingsGoalsWidgetProps {
  isCompact?: boolean;
}

interface GoalProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  monthlyTarget: number;
  daysRemaining: number;
  isOnTrack: boolean;
  isCompleted: boolean;
  targetDate: Date;
  category: string;
}

export default function SavingsGoalsWidget({ isCompact = false }: SavingsGoalsWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { goals, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const goalsProgress = useMemo(() => {
    const today = new Date();
    
    const activeGoals = goals
      .filter(goal => !goal.completedAt)
      .map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const remaining = goal.targetAmount - goal.currentAmount;
        const targetDate = goal.targetDate ? new Date(goal.targetDate) : addMonths(today, 12);
        const daysRemaining = Math.max(0, differenceInDays(targetDate, today));
        const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
        const monthlyTarget = remaining / monthsRemaining;
        
        // Calculate recent savings rate (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentSavings = transactions
          .filter(t => 
            new Date(t.date) >= thirtyDaysAgo &&
            t.category === 'savings' // Assuming savings category
          )
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const isOnTrack = recentSavings >= monthlyTarget * 0.9; // Within 90% of target
        
        return {
          id: goal.id,
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          progress: Math.min(100, progress),
          monthlyTarget,
          daysRemaining,
          isOnTrack,
          isCompleted: progress >= 100,
          targetDate,
          category: goal.category || 'General'
        } as GoalProgress;
      })
      .sort((a, b) => b.progress - a.progress); // Sort by progress

    return activeGoals;
  }, [goals, transactions]);

  const summary = useMemo(() => {
    const totalGoals = goalsProgress.length;
    const completedGoals = goalsProgress.filter(g => g.isCompleted).length;
    const onTrackGoals = goalsProgress.filter(g => g.isOnTrack && !g.isCompleted).length;
    const totalSaved = goalsProgress.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTarget = goalsProgress.reduce((sum, g) => sum + g.targetAmount, 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return {
      totalGoals,
      completedGoals,
      onTrackGoals,
      totalSaved,
      totalTarget,
      overallProgress
    };
  }, [goalsProgress]);

  if (goalsProgress.length === 0) {
    return (
      <div className="text-center py-8">
        <TargetIcon size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No active goals</p>
        <button
          onClick={() => navigate('/goals')}
          className="mt-2 text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
        >
          Set a goal →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Progress
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {summary.totalGoals} {summary.totalGoals === 1 ? 'goal' : 'goals'}
          </span>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {formatCurrency(summary.totalSaved)}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-gray-500 to-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(summary.overallProgress, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            {summary.overallProgress.toFixed(0)}% complete
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {formatCurrency(summary.totalTarget - summary.totalSaved)} to go
          </span>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
          <TrendingUpIcon size={14} className="text-green-600" />
          <div>
            <div className="text-sm font-semibold text-green-700 dark:text-green-300">
              {summary.onTrackGoals}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">On track</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-gray-900/20 rounded">
          <CheckCircleIcon size={14} className="text-gray-600" />
          <div>
            <div className="text-sm font-semibold text-blue-700 dark:text-gray-300">
              {summary.completedGoals}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
          </div>
        </div>
      </div>

      {/* Individual Goals */}
      <div className="space-y-3">
        {goalsProgress.slice(0, isCompact ? 2 : 3).map(goal => (
          <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {goal.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                  </span>
                  {goal.isOnTrack && !goal.isCompleted && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                      On track
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {goal.progress.toFixed(0)}%
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="relative">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    goal.isCompleted ? 'bg-green-500' :
                    goal.isOnTrack ? 'bg-gray-500' :
                    'bg-amber-500'
                  }`}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              {goal.progress > 5 && (
                <div 
                  className="absolute top-0 h-3 flex items-center px-1"
                  style={{ width: `${goal.progress}%` }}
                >
                  <span className="text-[10px] text-white font-medium ml-auto mr-1">
                    {goal.progress.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
            
            {/* Additional Info */}
            {!goal.isCompleted && (
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <ClockIcon size={12} />
                  <span>{goal.daysRemaining} days left</span>
                </div>
                <span>
                  {formatCurrency(goal.monthlyTarget)}/month needed
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* View All Button */}
      <button
        onClick={() => navigate('/goals')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        View All Goals →
      </button>
    </div>
  );
}