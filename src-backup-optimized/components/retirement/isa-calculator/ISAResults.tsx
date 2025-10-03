import React, { useEffect, memo } from 'react';
import { 
  CheckCircleIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  HomeIcon,
  DollarSignIcon
} from '../../icons';
import type { ISACalculation } from './types';
import { useLogger } from '../services/ServiceProvider';

interface ISAResultsProps {
  calculation: ISACalculation | null;
  formatCurrency: (value: number) => string;
}

export const ISAResults = memo(function ISAResults({ calculation,
  formatCurrency
 }: ISAResultsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ISAResults component initialized', {
      componentName: 'ISAResults'
    });
  }, []);

  if (!calculation) return <></>;

  return (
    <div className="space-y-4">
      {/* Recommendation */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500">
        <div className="flex items-start gap-3">
          <TrendingUpIcon size={24} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Recommendation
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {calculation.recommendation}
            </p>
          </div>
        </div>
      </div>

      {/* Allocation Summary */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-900 dark:text-white">Total ISA Usage</span>
          <span className="text-lg font-semibold">
            {formatCurrency(calculation.totalUsed)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Remaining Allowance</span>
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            {formatCurrency(calculation.remainingAllowance)}
          </span>
        </div>
      </div>

      {/* ISA Breakdown */}
      <div className="space-y-3">
        {/* Cash ISA */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h5 className="font-medium text-gray-900 dark:text-white mb-3">Cash ISA</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
              <span>{formatCurrency(calculation.cashISA.contribution)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Interest Rate:</span>
              <span>{calculation.cashISA.interestRate}%</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-gray-900 dark:text-white">Projected Value:</span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(calculation.cashISA.projectedValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tax Saved:</span>
              <span>{formatCurrency(calculation.cashISA.taxSaved)}</span>
            </div>
          </div>
        </div>

        {/* Stocks & Shares ISA */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h5 className="font-medium text-gray-900 dark:text-white mb-3">Stocks & Shares ISA</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
              <span>{formatCurrency(calculation.stocksISA.contribution)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Expected Return:</span>
              <span>{calculation.stocksISA.expectedReturn}%</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-gray-900 dark:text-white">Projected Value:</span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(calculation.stocksISA.projectedValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">CGT Saved:</span>
              <span>{formatCurrency(calculation.stocksISA.taxSaved)}</span>
            </div>
          </div>
        </div>

        {/* Lifetime ISA */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium text-gray-900 dark:text-white">Lifetime ISA</h5>
            {calculation.lifetimeISA.canUseForHome && (
              <HomeIcon size={18} className="text-green-500" title="Can use for first home" />
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
              <span>{formatCurrency(calculation.lifetimeISA.contribution)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Government Bonus:</span>
              <span className="text-green-600 dark:text-green-400">
                +{formatCurrency(calculation.lifetimeISA.governmentBonus)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total with Bonus:</span>
              <span>{formatCurrency(calculation.lifetimeISA.totalContribution)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-gray-900 dark:text-white">Projected Value:</span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(calculation.lifetimeISA.projectedValue)}
              </span>
            </div>
            {calculation.lifetimeISA.earlyWithdrawalPenalty > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Early Withdrawal Penalty:</span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(calculation.lifetimeISA.earlyWithdrawalPenalty)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Net After Penalty:</span>
                  <span>{formatCurrency(calculation.lifetimeISA.netAfterPenalty)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Total Projection */}
      <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSignIcon size={20} className="text-primary" />
            <span className="font-medium text-gray-900 dark:text-white">
              Total Projected Value:
            </span>
          </div>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(
              calculation.cashISA.projectedValue + 
              calculation.stocksISA.projectedValue + 
              calculation.lifetimeISA.projectedValue
            )}
          </span>
        </div>
      </div>
    </div>
  );
});