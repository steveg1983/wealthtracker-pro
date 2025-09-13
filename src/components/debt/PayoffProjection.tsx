import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { logger } from '../../services/loggingService';

export interface PayoffStrategy {
  type: 'avalanche' | 'snowball' | 'custom';
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  monthlyPayment: number;
  payoffOrder: string[];
  savingsVsMinimum: number;
  projections: Array<{
    month: number;
    date: Date;
    payments: Record<string, number>;
    balances: Record<string, number>;
    totalPaid: number;
    totalRemaining: number;
  }>;
}

interface PayoffProjectionProps {
  projection: PayoffStrategy;
  onClose: () => void;
}

export const PayoffProjection = memo(function PayoffProjection({
  projection,
  onClose
}: PayoffProjectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PayoffProjection component initialized', {
      componentName: 'PayoffProjection'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Payoff Projection
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ×
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Payoff Time</p>
          <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
            {projection.totalMonths} months
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {Math.floor(projection.totalMonths / 12)} years, {projection.totalMonths % 12} months
          </p>
        </div>
        
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(projection.totalInterest)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Interest paid
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Interest Saved</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(projection.savingsVsMinimum)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            vs minimum payments
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(projection.monthlyPayment)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total monthly
          </p>
        </div>
      </div>
      
      {/* Payoff Order */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Payoff Order ({projection.type.charAt(0).toUpperCase() + projection.type.slice(1)} Strategy)
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          {projection.payoffOrder.map((name, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg"
            >
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                #{index + 1}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Monthly Breakdown (first 12 months) */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          First Year Monthly Breakdown
        </h4>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left py-2">Month</th>
                <th className="text-right py-2">Payment</th>
                <th className="text-right py-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {projection.projections.slice(0, 12).map((proj, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 text-gray-600 dark:text-gray-400">
                    {proj.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-white">
                    {formatCurrency(Object.values(proj.payments).reduce((sum, p) => sum + p, 0))}
                  </td>
                  <td className="text-right py-2 text-red-600 dark:text-red-400">
                    {formatCurrency(proj.totalRemaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});