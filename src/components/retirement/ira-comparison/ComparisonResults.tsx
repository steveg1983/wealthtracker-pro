import React, { useEffect, memo } from 'react';
import { 
  CheckCircleIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  DollarSignIcon
} from '../../icons';
import type { IRAComparison } from './types';
import { logger } from '../../../services/loggingService';

interface ComparisonResultsProps {
  comparison: IRAComparison | null;
  formatCurrency: (value: number) => string;
  getRecommendationText: () => string;
}

export const ComparisonResults = memo(function ComparisonResults({
  comparison,
  formatCurrency,
  getRecommendationText
}: ComparisonResultsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ComparisonResults component initialized', {
      componentName: 'ComparisonResults'
    });
  }, []);

  if (!comparison) return <></>;

  return (
    <div className="space-y-4">
      {/* Recommendation */}
      <div className={`p-4 rounded-lg border-2 ${
        comparison.recommendation === 'traditional' 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
          : comparison.recommendation === 'roth'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
      }`}>
        <div className="flex items-start gap-3">
          {comparison.recommendation === 'roth' ? (
            <CheckCircleIcon size={24} className="text-green-600 dark:text-green-400 mt-0.5" />
          ) : (
            <AlertCircleIcon size={24} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          )}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {getRecommendationText()}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Based on your tax situation and eligibility
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Traditional IRA */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            Traditional IRA
          </h4>
          
          {!comparison.traditional.canDeduct && (
            <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-200">
              Limited or no deduction due to income
            </div>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
              <span className="font-medium">
                {formatCurrency(comparison.traditional.contributionAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tax Deduction:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                -{formatCurrency(comparison.traditional.taxDeductionNow)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Net Cost Now:</span>
              <span className="font-medium">
                {formatCurrency(comparison.traditional.netCostNow)}
              </span>
            </div>
            <div className="border-t dark:border-gray-600 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Future Value:</span>
                <span className="font-medium">
                  {formatCurrency(comparison.traditional.projectedBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Taxes in Retirement:</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  -{formatCurrency(comparison.traditional.taxesOnWithdrawal)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-gray-900 dark:text-white">Net Withdrawal:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(comparison.traditional.netWithdrawal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Roth IRA */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            Roth IRA
          </h4>
          
          {!comparison.roth.canContribute && (
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-200">
              Income too high to contribute
            </div>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
              <span className="font-medium">
                {formatCurrency(comparison.roth.contributionAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tax Deduction:</span>
              <span className="font-medium text-gray-500">
                {formatCurrency(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Net Cost Now:</span>
              <span className="font-medium">
                {formatCurrency(comparison.roth.netCostNow)}
              </span>
            </div>
            <div className="border-t dark:border-gray-600 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Future Value:</span>
                <span className="font-medium">
                  {formatCurrency(comparison.roth.projectedBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Taxes in Retirement:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-gray-900 dark:text-white">Net Withdrawal:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(comparison.roth.netWithdrawal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Difference */}
      <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUpIcon size={20} className="text-primary" />
            <span className="font-medium text-gray-900 dark:text-white">
              Advantage Amount:
            </span>
          </div>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(comparison.difference)}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {comparison.traditional.netWithdrawal > comparison.roth.netWithdrawal 
            ? 'Traditional IRA provides more after-tax income'
            : 'Roth IRA provides more after-tax income'
          }
        </p>
      </div>
    </div>
  );
});