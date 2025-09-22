import React, { useEffect, memo, useCallback } from 'react';
import { PiggyBankIcon, EditIcon, TrashIcon, TrendingUpIcon, CalendarIcon, DollarSignIcon } from '../icons';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import type { FinancialPlan } from '../../services/financialPlanningService';
import { useLogger } from '../services/ServiceProvider';

interface RetirementPlanCardProps {
  plan: FinancialPlan;
  onEdit: (plan: FinancialPlan) => void;
  onDelete: (planId: string) => void;
  onViewProjection: (plan: FinancialPlan) => void;
}

export const RetirementPlanCard = memo(function RetirementPlanCard({ plan, 
  onEdit, 
  onDelete, 
  onViewProjection 
 }: RetirementPlanCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RetirementPlanCard component initialized', {
      componentName: 'RetirementPlanCard'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();
  
  const handleEdit = useCallback(() => {
    onEdit(plan);
  }, [plan, onEdit]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Are you sure you want to delete "${plan.name}"?`)) {
      onDelete(plan.id);
    }
  }, [plan, onDelete]);

  const handleViewProjection = useCallback(() => {
    onViewProjection(plan);
  }, [plan, onViewProjection]);

  const yearsToRetirement = (plan.data?.retirementAge || 65) - (plan.data?.currentAge || 35);
  const isActive = plan.is_active;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${
      isActive ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'
    } p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-lg ${
            isActive ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-900'
          }`}>
            <PiggyBankIcon className={`w-6 h-6 ${
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {plan.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isActive 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
            }`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleEdit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Edit plan"
          >
            <EditIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            aria-label="Delete plan"
          >
            <TrashIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Age</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {plan.data?.currentAge || 0} years
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Retirement Age</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {plan.data?.retirementAge || 0} years
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Years to Retire</p>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {yearsToRetirement} years
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected Return</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            {((plan.data?.expectedReturn || 0) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <DollarSignIcon className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Savings</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(plan.data?.currentSavings || 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Contribution</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(plan.data?.monthlyContribution || 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Target Income</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(plan.data?.targetRetirementIncome || 0)}/mo
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleViewProjection}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
      >
        <TrendingUpIcon className="w-4 h-4" />
        <span>View Projection</span>
      </button>
    </div>
  );
});