import React, { useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, InfoIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface AffordabilityResultsProps {
  annualIncome: number;
  maxLoan: number;
  requestedLoan: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  existingDebt: number;
  estimatedMortgagePayment: number;
  stressTestRate: number;
  stressTestPayment: number;
  stressTestPassed: boolean;
  affordabilityRatio: number;
  disposableIncome: number;
  formatCurrency: (value: number) => string;
}

export const AffordabilityResults: React.FC<AffordabilityResultsProps> = ({
  annualIncome,
  maxLoan,
  requestedLoan,
  monthlyIncome,
  monthlyExpenses,
  existingDebt,
  estimatedMortgagePayment,
  stressTestRate,
  stressTestPayment,
  stressTestPassed,
  affordabilityRatio,
  disposableIncome,
  formatCurrency
}) => {
  const canAfford = requestedLoan <= maxLoan && stressTestPassed;
  const incomeMultiple = maxLoan / annualIncome;
  const debtToIncomeRatio = ((existingDebt + estimatedMortgagePayment) / monthlyIncome) * 100;
  
  return (
    <div className="mt-6 space-y-4">
      {/* Main Affordability Result */}
      <div className={`p-4 rounded-lg ${
        canAfford 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          {canAfford ? (
            <CheckCircleIcon size={20} className="text-green-500" />
          ) : (
            <XCircleIcon size={20} className="text-red-500" />
          )}
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {canAfford ? 'Mortgage Affordable' : 'Affordability Concerns'}
          </h4>
        </div>
        
        <div className="space-y-2 text-sm">
          <p className="text-gray-700 dark:text-gray-300">
            Based on your income of {formatCurrency(annualIncome)}/year, you can borrow up to:
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(maxLoan)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            This is {incomeMultiple.toFixed(1)}x your annual income
          </p>
        </div>
      </div>

      {/* Income & Expenses Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Monthly Income & Expenses
          </h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Monthly Income:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatCurrency(monthlyIncome)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Living Expenses:</span>
              <span className="text-gray-900 dark:text-white">
                -{formatCurrency(monthlyExpenses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Existing Debt Payments:</span>
              <span className="text-gray-900 dark:text-white">
                -{formatCurrency(existingDebt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Proposed Mortgage:</span>
              <span className="text-gray-900 dark:text-white">
                -{formatCurrency(estimatedMortgagePayment)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Remaining:</span>
              <span className={`font-semibold ${
                disposableIncome > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(disposableIncome)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Key Ratios
          </h5>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Debt-to-Income:</span>
                <span className={`font-medium ${
                  debtToIncomeRatio < 36 ? 'text-green-600 dark:text-green-400' : 
                  debtToIncomeRatio < 43 ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-red-600 dark:text-red-400'
                }`}>
                  {debtToIncomeRatio.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    debtToIncomeRatio < 36 ? 'bg-green-500' : 
                    debtToIncomeRatio < 43 ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(debtToIncomeRatio, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Target: Below 36% | Maximum: 43%
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Affordability Buffer:</span>
                <span className={`font-medium ${
                  affordabilityRatio > 0.2 ? 'text-green-600 dark:text-green-400' : 
                  affordabilityRatio > 0.1 ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-red-600 dark:text-red-400'
                }`}>
                  {(affordabilityRatio * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Percentage of income remaining after all expenses
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stress Test Results */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <InfoIcon size={16} className="text-blue-500" />
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Stress Test Analysis
          </h5>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Can you afford the mortgage if rates increase to {stressTestRate.toFixed(1)}%?
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Payment:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(estimatedMortgagePayment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Stressed Payment:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatCurrency(stressTestPayment)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              stressTestPassed 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {stressTestPassed ? (
                <>
                  <CheckCircleIcon size={16} />
                  <span className="text-sm font-medium">Stress Test Passed</span>
                </>
              ) : (
                <>
                  <XCircleIcon size={16} />
                  <span className="text-sm font-medium">Stress Test Failed</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded text-xs text-gray-600 dark:text-gray-400">
          <p>Lenders typically stress test at 3% above the offered rate or a minimum of 6-7%</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Recommendations
        </h5>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          {debtToIncomeRatio > 36 && (
            <li className="flex items-start">
              <span className="text-orange-500 mr-1">•</span>
              Consider reducing existing debt to improve your debt-to-income ratio
            </li>
          )}
          {affordabilityRatio < 0.1 && (
            <li className="flex items-start">
              <span className="text-orange-500 mr-1">•</span>
              Your budget will be very tight - consider a smaller loan or reducing expenses
            </li>
          )}
          {!stressTestPassed && (
            <li className="flex items-start">
              <span className="text-red-500 mr-1">•</span>
              Consider a smaller loan amount to pass the stress test
            </li>
          )}
          <li className="flex items-start">
            <span className="text-blue-500 mr-1">•</span>
            Remember to budget for additional costs: maintenance, insurance, utilities
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-1">•</span>
            Keep an emergency fund of 3-6 months expenses
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AffordabilityResults;