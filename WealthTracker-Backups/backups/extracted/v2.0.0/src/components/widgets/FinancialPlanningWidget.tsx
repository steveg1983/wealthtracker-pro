import React, { useState, useEffect } from 'react';
import { financialPlanningService } from '../../services/financialPlanningService';
import { 
  CalculatorIcon,
  PiggyBankIcon,
  HomeIcon,
  TargetIcon,
  CreditCardIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '../icons';
import { useNavigate } from 'react-router-dom';
import type { RetirementPlan, FinancialGoal } from '../../services/financialPlanningService';
import type { BaseWidgetProps } from '../../types/widget-types';

interface FinancialPlanningWidgetProps extends BaseWidgetProps {}

export default function FinancialPlanningWidget({ size = 'medium' }: FinancialPlanningWidgetProps) {
  const navigate = useNavigate();
  const [retirementPlans, setRetirementPlans] = useState<RetirementPlan[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setRetirementPlans(financialPlanningService.getRetirementPlans());
      setFinancialGoals(financialPlanningService.getFinancialGoals());
    } catch (error) {
      console.error('Error loading financial planning data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getGoalProgress = (goal: FinancialGoal) => {
    return (goal.currentSavings / goal.targetAmount) * 100;
  };

  const getGoalStatus = (goal: FinancialGoal) => {
    const projection = financialPlanningService.calculateGoalProjection(goal);
    return projection.onTrack;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (size === 'small') {
    return (
      <div className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3">
        <div className="flex items-center justify-between mb-2">
          <CalculatorIcon size={20} className="text-purple-600 dark:text-purple-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Planning</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {retirementPlans.length + financialGoals.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active Plans</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CalculatorIcon size={20} className="text-purple-600 dark:text-purple-400" />
          Financial Planning
        </h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {retirementPlans.length + financialGoals.length} Plans
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBankIcon size={16} className="text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-purple-800 dark:text-purple-200">Retirement</span>
            </div>
            <div className="text-sm font-bold text-purple-900 dark:text-purple-100">
              {retirementPlans.length} Plans
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TargetIcon size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-800 dark:text-blue-200">Goals</span>
            </div>
            <div className="text-sm font-bold text-blue-900 dark:text-blue-100">
              {financialGoals.length} Active
            </div>
          </div>
        </div>

        {/* Recent Plans */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Recent Plans</h4>
          
          {retirementPlans.length === 0 && financialGoals.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                No financial plans yet
              </p>
              <button
                onClick={() => navigate('/financial-planning')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create your first plan
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Retirement Plans */}
              {retirementPlans.slice(0, 2).map((plan) => {
                const projection = financialPlanningService.calculateRetirementProjection(plan);
                return (
                  <div key={plan.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <PiggyBankIcon size={14} className="text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {plan.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {projection.yearsToRetirement} years to go
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-900 dark:text-white">
                      {formatCurrency(projection.totalSavingsAtRetirement)}
                    </div>
                  </div>
                );
              })}

              {/* Financial Goals */}
              {financialGoals.slice(0, 2).map((goal) => {
                const progress = getGoalProgress(goal);
                const onTrack = getGoalStatus(goal);
                
                return (
                  <div key={goal.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <TargetIcon size={14} className="text-blue-600 dark:text-blue-400" />
                        {onTrack ? (
                          <CheckCircleIcon size={12} className="text-green-500" />
                        ) : (
                          <AlertCircleIcon size={12} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {goal.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {progress.toFixed(1)}% complete
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-900 dark:text-white">
                      {formatCurrency(goal.targetAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Quick Actions</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/financial-planning?tab=retirement')}
              className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <PiggyBankIcon size={14} className="text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-purple-800 dark:text-purple-200">
                Retirement
              </span>
            </button>
            
            <button
              onClick={() => navigate('/financial-planning?tab=mortgage')}
              className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <HomeIcon size={14} className="text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-800 dark:text-green-200">
                Mortgage
              </span>
            </button>
          </div>
        </div>

        {/* Financial Planning Button */}
        <button
          onClick={() => navigate('/financial-planning')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          Financial Planning
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}