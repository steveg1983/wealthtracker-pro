import { memo, useEffect } from 'react';
import { BudgetProgressService } from '../../../services/budgetProgressService';
import type { SpendingVelocity } from '../../../services/budgetProgressService';
import { logger } from '../../../services/loggingService';

interface BudgetProgressBarProps {
  percentage: number;
  velocity: SpendingVelocity;
  spent: number;
  amount: number;
  formatCurrency: (amount: number) => string;
  showDetails?: boolean;
}

export const BudgetProgressBar = memo(function BudgetProgressBar({
  percentage,
  velocity,
  spent,
  amount,
  formatCurrency,
  showDetails = true
}: BudgetProgressBarProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetProgressBar component initialized', {
      componentName: 'BudgetProgressBar'
    });
  }, []);

  const progressColor = BudgetProgressService.getProgressColor(percentage, velocity);
  
  return (
    <div className="space-y-2">
      {showDetails && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {formatCurrency(spent)} spent
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {formatCurrency(amount)} budget
          </span>
        </div>
      )}
      
      <div className="relative">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full ${progressColor} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${percentage}%` }}
          >
            {percentage > 10 && (
              <div className="h-full flex items-center justify-end pr-2">
                <span className="text-xs text-white font-medium">
                  {percentage.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Projected line */}
        {velocity.projectedTotal > amount && percentage < 100 && (
          <div 
            className="absolute top-0 h-3 w-0.5 bg-red-600 dark:bg-red-400"
            style={{ left: `${Math.min(95, (velocity.projectedTotal / amount) * 100)}%` }}
            title="Projected overspend"
          />
        )}
      </div>
    </div>
  );
});