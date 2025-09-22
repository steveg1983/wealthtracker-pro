import React, { useEffect, memo } from 'react';
import { XIcon, TrendingUpIcon, AlertCircleIcon, CheckCircleIcon, BarChart3Icon } from '../icons';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import Decimal from 'decimal.js';
import { useLogger } from '../services/ServiceProvider';

interface RetirementProjection {
  totalSavingsAtRetirement: number;
  monthlyIncomeAvailable: number;
  yearsToRetirement: number;
  shortfall: number;
  recommendedMonthlyContribution: number;
  totalContributions: number;
  totalGrowth: number;
  projectionsByYear: Array<{
    year: number;
    age: number;
    contribution: number;
    growth: number;
    balance: number;
  }>;
}

interface RetirementProjectionDisplayProps {
  projection: RetirementProjection | null;
  planName: string;
  onClose: () => void;
}

export const RetirementProjectionDisplay = memo(function RetirementProjectionDisplay({ projection, 
  planName, 
  onClose 
 }: RetirementProjectionDisplayProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RetirementProjectionDisplay component initialized', {
      componentName: 'RetirementProjectionDisplay'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  if (!projection) return <></>;

  const isOnTrack = projection.shortfall <= 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Retirement Projection: {planName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close projection"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <TrendingUpIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(projection.totalSavingsAtRetirement)}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Total at Retirement
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <BarChart3Icon className="w-8 h-8 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(projection.monthlyIncomeAvailable)}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Monthly Income
              </p>
            </div>

            <div className={`${isOnTrack ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'} rounded-lg p-4`}>
              <div className="flex items-center justify-between">
                {isOnTrack ? (
                  <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                )}
                <span className={`text-2xl font-bold ${isOnTrack ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isOnTrack ? 'On Track' : formatCurrency(Math.abs(projection.shortfall))}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {isOnTrack ? 'Goal Status' : 'Shortfall'}
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Years to Retire</span>
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {projection.yearsToRetirement}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Recommended: {formatCurrency(projection.recommendedMonthlyContribution)}/mo
              </p>
            </div>
          </div>

          {/* Contribution vs Growth Breakdown */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Savings Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Contributions</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(projection.totalContributions)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Investment Growth</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(projection.totalGrowth)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Growth Percentage</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {projection.totalContributions > 0 
                    ? `${((projection.totalGrowth / projection.totalContributions) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </div>

          {/* Year by Year Projection Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
            <h3 className="text-lg font-semibold p-4 border-b dark:border-gray-700 text-gray-900 dark:text-gray-100">
              Year-by-Year Projection
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Year
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Age
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      Annual Contribution
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      Investment Growth
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {projection.projectionsByYear.map((yearData, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {yearData.year}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {yearData.age}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(yearData.contribution)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-green-600 dark:text-green-400">
                        {formatCurrency(yearData.growth)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(yearData.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {!isOnTrack && (
            <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                Recommendations to Meet Your Goal
              </h3>
              <ul className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>
                    Increase monthly contribution to {formatCurrency(projection.recommendedMonthlyContribution)}
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Consider delaying retirement by a few years to allow more time for compound growth</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Review and optimize your investment strategy for better returns</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Look for ways to reduce expenses and increase savings rate</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});