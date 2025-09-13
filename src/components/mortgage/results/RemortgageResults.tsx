import React, { useEffect } from 'react';
import { TrendingUpIcon, AlertTriangleIcon, CheckCircleIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface RemortgageResultsProps {
  currentBalance: number;
  currentRate: number;
  currentPayment: number;
  currentRemainingYears: number;
  newRate: number;
  newPayment: number;
  newTermYears: number;
  arrangementFee: number;
  monthlySavings: number;
  totalSavings: number;
  breakEvenMonths: number;
  worthRemortgaging: boolean;
  formatCurrency: (value: number) => string;
}

export const RemortgageResults: React.FC<RemortgageResultsProps> = ({
  currentBalance,
  currentRate,
  currentPayment,
  currentRemainingYears,
  newRate,
  newPayment,
  newTermYears,
  arrangementFee,
  monthlySavings,
  totalSavings,
  breakEvenMonths,
  worthRemortgaging,
  formatCurrency
}) => {
  const isExtendingTerm = newTermYears > currentRemainingYears;
  const isSaving = monthlySavings > 0;
  
  return (
    <div className="mt-6 space-y-4">
      {/* Recommendation Banner */}
      <div className={`p-4 rounded-lg ${
        worthRemortgaging 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
          : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {worthRemortgaging ? (
            <CheckCircleIcon size={20} className="text-green-500" />
          ) : (
            <AlertTriangleIcon size={20} className="text-orange-500" />
          )}
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {worthRemortgaging ? 'Remortgaging Recommended' : 'Consider Carefully'}
          </h4>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {worthRemortgaging 
            ? `You'll save ${formatCurrency(monthlySavings)} per month and break even in ${breakEvenMonths} months`
            : monthlySavings > 0 
              ? `Small savings of ${formatCurrency(monthlySavings)}/month - may not justify the hassle`
              : `Your payments will increase by ${formatCurrency(Math.abs(monthlySavings))}/month`
          }
        </p>
      </div>

      {/* Comparison Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Mortgage */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Current Mortgage
          </h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Outstanding Balance:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(currentBalance)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Interest Rate:</span>
              <span className="text-gray-900 dark:text-white">
                {currentRate.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Monthly Payment:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatCurrency(currentPayment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Years Remaining:</span>
              <span className="text-gray-900 dark:text-white">
                {currentRemainingYears} years
              </span>
            </div>
          </div>
        </div>

        {/* New Mortgage */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            New Mortgage Offer
          </h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Loan Amount:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(currentBalance)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Interest Rate:</span>
              <span className={`font-medium ${
                newRate < currentRate ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
              }`}>
                {newRate.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Monthly Payment:</span>
              <span className={`font-medium ${
                isSaving ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {formatCurrency(newPayment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Term:</span>
              <span className="text-gray-900 dark:text-white">
                {newTermYears} years
                {isExtendingTerm && (
                  <span className="text-xs text-orange-600 dark:text-orange-400 ml-1">
                    (+{newTermYears - currentRemainingYears})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Impact */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUpIcon size={16} className="text-blue-500" />
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Financial Impact
          </h5>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Monthly Difference:</span>
              <span className={`font-medium ${
                isSaving ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {isSaving ? '-' : '+'}{formatCurrency(Math.abs(monthlySavings))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Arrangement Fee:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(arrangementFee)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Break-even Time:</span>
              <span className="text-gray-900 dark:text-white">
                {breakEvenMonths > 0 ? `${breakEvenMonths} months` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Savings:</span>
              <span className={`font-medium ${
                totalSavings > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {totalSavings > 0 ? formatCurrency(totalSavings) : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Considerations */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
            Consider These Factors:
          </p>
          <ul className="space-y-1 text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <span className="text-gray-500 mr-1">•</span>
              Early repayment charges on current mortgage
            </li>
            <li className="flex items-start">
              <span className="text-gray-500 mr-1">•</span>
              Legal and valuation fees (typically £500-£1,500)
            </li>
            {isExtendingTerm && (
              <li className="flex items-start">
                <span className="text-orange-500 mr-1">•</span>
                <span>
                  Extending term by {newTermYears - currentRemainingYears} years will increase total interest paid
                </span>
              </li>
            )}
            <li className="flex items-start">
              <span className="text-gray-500 mr-1">•</span>
              Your credit score may affect the rate offered
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RemortgageResults;