import React, { useEffect } from 'react';
import { logger } from '../../../services/loggingService';

interface MortgageType {
  type: string;
  rate: number;
  monthlyPayment: number;
  totalInterest: number;
  pros: string[];
  cons: string[];
}

interface MortgageTypesComparisonProps {
  loanAmount: number;
  termYears: number;
  mortgageTypes: MortgageType[];
  formatCurrency: (value: number) => string;
}

export const MortgageTypesComparison: React.FC<MortgageTypesComparisonProps> = ({
  loanAmount,
  termYears,
  mortgageTypes,
  formatCurrency
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Rate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Monthly
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Total Interest
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
              Pros/Cons
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {mortgageTypes.map((type) => (
            <tr key={type.type} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {type.type}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {(type.rate * 100).toFixed(2)}%
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                {formatCurrency(type.monthlyPayment)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                {formatCurrency(type.totalInterest)}
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="space-y-1">
                  {type.pros.slice(0, 2).map((pro, i) => (
                    <div key={i} className="text-green-600 dark:text-green-400 text-xs">
                      + {pro}
                    </div>
                  ))}
                  {type.cons.slice(0, 1).map((con, i) => (
                    <div key={i} className="text-red-600 dark:text-red-400 text-xs">
                      - {con}
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* UK-specific mortgage type information */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          UK Mortgage Types Explained
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Fixed Rate</h6>
            <p className="text-gray-600 dark:text-gray-400">
              Interest rate stays the same for a set period (typically 2-5 years). Payments won't change during this time.
            </p>
          </div>
          <div>
            <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Variable Rate</h6>
            <p className="text-gray-600 dark:text-gray-400">
              Rate can go up or down at the lender's discretion. Usually follows Bank of England base rate changes.
            </p>
          </div>
          <div>
            <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Tracker</h6>
            <p className="text-gray-600 dark:text-gray-400">
              Directly tracks the Bank of England base rate plus a fixed percentage. Transparent but can fluctuate.
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Note:</strong> After any fixed or tracker period ends, you'll usually move to the lender's Standard Variable Rate (SVR), 
            which is typically higher. Most people remortgage before this happens.
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">Lowest Monthly Payment</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(Math.min(...mortgageTypes.map(t => t.monthlyPayment)))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {mortgageTypes.find(t => t.monthlyPayment === Math.min(...mortgageTypes.map(m => m.monthlyPayment)))?.type}
          </p>
        </div>

        <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">Lowest Total Interest</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(Math.min(...mortgageTypes.map(t => t.totalInterest)))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {mortgageTypes.find(t => t.totalInterest === Math.min(...mortgageTypes.map(m => m.totalInterest)))?.type}
          </p>
        </div>

        <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">Payment Range</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(Math.max(...mortgageTypes.map(t => t.monthlyPayment)) - Math.min(...mortgageTypes.map(t => t.monthlyPayment)))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Monthly difference
          </p>
        </div>
      </div>
    </div>
  );
};

export default MortgageTypesComparison;