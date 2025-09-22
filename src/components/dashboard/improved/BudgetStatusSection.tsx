import { memo, useEffect } from 'react';
import { PieChartIcon } from '../../icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { preserveDemoParam } from '../../../utils/navigation';
import { useLogger } from '../services/ServiceProvider';

interface BudgetStatus {
  id: string;
  category: string;
  name?: string;
  categoryId?: string;
  amount: number;
  spent: number;
  percentUsed: number;
  isOverBudget: boolean;
}

interface BudgetStatusSectionProps {
  budgetStatus: BudgetStatus[];
  overallBudgetPercent: number;
  formatCurrency: (amount: number) => string;
  t: (key: string, defaultValue: string) => string;
}

/**
 * Budget status section component
 * Shows current budget progress with visual indicators
 */
export const BudgetStatusSection = memo(function BudgetStatusSection({ budgetStatus,
  overallBudgetPercent,
  formatCurrency,
  t
 }: BudgetStatusSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetStatusSection component initialized', {
      componentName: 'BudgetStatusSection'
    });
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  if (budgetStatus.length === 0) return <></>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6" data-testid="budget-status">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <PieChartIcon size={24} className="text-gray-500" />
        {t('dashboard.budgetStatus', 'Budget Status')}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({overallBudgetPercent.toFixed(0)}% {t('dashboard.used', 'used')})
        </span>
      </h3>
      
      <div className="space-y-3">
        {budgetStatus.slice(0, 3).map(budget => (
          <div key={budget.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {budget.name || budget.categoryId || budget.category}
              </span>
              <span className={`font-medium ${
                budget.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  budget.percentUsed > 100 ? 'bg-red-500' :
                  budget.percentUsed > 80 ? 'bg-yellow-500' :
                  budget.percentUsed > 60 ? 'bg-gray-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
              />
            </div>
          </div>
        ))}
        
        {budgetStatus.length > 3 && (
          <button 
            onClick={() => navigate(preserveDemoParam('/budget', location.search))}
            className="w-full mt-2 py-2 text-gray-600 dark:text-gray-500 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            View All Budgets ({budgetStatus.length}) →
          </button>
        )}
      </div>
    </div>
  );
});
