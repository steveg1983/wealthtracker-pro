import React, { useEffect } from 'react';
import type { PayoffStrategy, PayoffProjection } from '../../DebtManagement';
import { useLogger } from '../services/ServiceProvider';

interface PayoffStrategyTabProps {
  payoffStrategy: PayoffStrategy;
  projections: PayoffProjection[];
  formatCurrency: (value: number) => string;
  onStrategyChange: (type: PayoffStrategy['type']) => void;
}

export function PayoffStrategyTab({ payoffStrategy, 
  projections, 
  formatCurrency, 
  onStrategyChange 
 }: PayoffStrategyTabProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="space-y-6">
      {/* Strategy Selection */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Payoff Strategy
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onStrategyChange('snowball')}
            className={`p-4 text-left border rounded-lg transition-colors ${
              payoffStrategy.type === 'snowball'
                ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Debt Snowball
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pay off smallest balances first for psychological wins
            </p>
          </button>
          
          <button
            onClick={() => onStrategyChange('avalanche')}
            className={`p-4 text-left border rounded-lg transition-colors ${
              payoffStrategy.type === 'avalanche'
                ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Debt Avalanche
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pay off highest interest rates first to minimize total interest
            </p>
          </button>
        </div>
      </div>

      {/* Payoff Projections */}
      {projections.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payoff Projections
          </h3>
          
          <div className="space-y-4">
            {projections.map(projection => (
              <div
                key={projection.debtId}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {projection.debtName}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.floor(projection.monthsToPayoff / 12)}y {projection.monthsToPayoff % 12}m to pay off
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
                  <p className="font-medium text-orange-600 dark:text-orange-400">
                    {formatCurrency(projection.totalInterest.toNumber())}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
