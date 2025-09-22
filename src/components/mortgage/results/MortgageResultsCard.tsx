import React, { useEffect } from 'react';
import { InfoIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface MortgageResultsCardProps {
  monthlyPayment: number;
  totalInterest: number;
  totalPayable: number;
  loanAmount: number;
  stampDuty?: number;
  propertyTax?: number;
  pmi?: number;
  formatCurrency: (value: number) => string;
  region: 'UK' | 'US';
}

export const MortgageResultsCard: React.FC<MortgageResultsCardProps> = ({
  monthlyPayment,
  totalInterest,
  totalPayable,
  loanAmount,
  stampDuty,
  propertyTax,
  pmi,
  formatCurrency,
  region
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Monthly Payment
        </h3>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(monthlyPayment)}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">Loan Amount</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(loanAmount)}
          </span>
        </div>

        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total Interest</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(totalInterest)}
          </span>
        </div>

        {region === 'UK' && stampDuty !== undefined && stampDuty > 0 && (
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">Stamp Duty</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(stampDuty)}
            </span>
          </div>
        )}

        {region === 'US' && (
          <>
            {propertyTax !== undefined && propertyTax > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Property Tax (Monthly)</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(propertyTax)}
                </span>
              </div>
            )}
            {pmi !== undefined && pmi > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">PMI (Monthly)</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(pmi)}
                </span>
              </div>
            )}
          </>
        )}

        <div className="flex justify-between py-2 font-semibold">
          <span className="text-gray-700 dark:text-gray-300">Total Payable</span>
          <span className="text-gray-900 dark:text-white">
            {formatCurrency(totalPayable)}
          </span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex items-start gap-2">
          <InfoIcon size={16} className="text-gray-500 mt-0.5" />
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">Cost Breakdown:</p>
            <p>Principal: {formatCurrency(loanAmount)} ({((loanAmount / totalPayable) * 100).toFixed(1)}%)</p>
            <p>Interest: {formatCurrency(totalInterest)} ({((totalInterest / totalPayable) * 100).toFixed(1)}%)</p>
            {stampDuty && stampDuty > 0 && (
              <p>Stamp Duty: {formatCurrency(stampDuty)} ({((stampDuty / totalPayable) * 100).toFixed(1)}%)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MortgageResultsCard;