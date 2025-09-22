/**
 * Calculation Details Component
 * Displays detailed mortgage calculation information
 */

import React, { useEffect } from 'react';
import { DollarSignIcon, TrendingUpIcon, HomeIcon } from '../icons';
import { mortgageCalculatorComponentService } from '../../services/mortgageCalculatorComponentService';
import type { MortgageCalculation } from '../../types/financial-plans';
import { useLogger } from '../services/ServiceProvider';

interface CalculationDetailsProps {
  calculation: MortgageCalculation;
}

const CalculationDetails = React.memo(({ calculation }: CalculationDetailsProps) => {
  const { formatCurrency, formatPercentage, formatDate } = mortgageCalculatorComponentService;
  const amortizationPreview = mortgageCalculatorComponentService.getAmortizationPreview(calculation);

  return (
    <div className="lg:col-span-2 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                {formatCurrency(calculation.monthly_payment)}
              </p>
            </div>
            <DollarSignIcon size={24} className="text-gray-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(calculation.total_interest)}
              </p>
            </div>
            <TrendingUpIcon size={24} className="text-red-500" />
          </div>
        </div>
      </div>

      {/* Loan Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <HomeIcon size={20} />
          Loan Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Loan Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(calculation.loan_amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Interest Rate:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatPercentage(calculation.interest_rate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Loan Term:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {calculation.term_years} years
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(calculation.monthly_payment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Cost:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency((calculation.loan_amount + calculation.total_interest))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Payoff Date:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatDate(new Date())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Amortization Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Amortization Schedule (First {amortizationPreview.previewCount} Months)
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Payment</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Principal</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Interest</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {amortizationPreview.entries.map((entry: any) => (
                <tr key={entry.paymentNumber}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">
                    {entry.paymentNumber}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {formatDate(entry.paymentDate)}
                  </td>
                  <td className="px-3 py-2 text-green-600 dark:text-green-400">
                    {formatCurrency(entry.principalPayment)}
                  </td>
                  <td className="px-3 py-2 text-red-600 dark:text-red-400">
                    {formatCurrency(entry.interestPayment)}
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">
                    {formatCurrency(entry.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="text-center mt-4 text-gray-500 dark:text-gray-400">
          Showing first {amortizationPreview.previewCount} of {amortizationPreview.totalPayments} payments
        </div>
      </div>
    </div>
  );
});

CalculationDetails.displayName = 'CalculationDetails';

export default CalculationDetails;