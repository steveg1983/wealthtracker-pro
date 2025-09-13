/**
 * Calculations List Component
 * Displays list of saved mortgage calculations
 */

import React, { useEffect } from 'react';
import { PlusIcon, TrashIcon } from '../icons';
import { mortgageCalculatorComponentService } from '../../services/mortgageCalculatorComponentService';
import type { MortgageCalculation } from '../../types/financial-plans';
import { logger } from '../../services/loggingService';

interface CalculationsListProps {
  calculations: MortgageCalculation[];
  selectedCalculation: MortgageCalculation | null;
  onCalculationSelect: (calc: MortgageCalculation) => void;
  onCalculationDelete: (calc: MortgageCalculation) => void;
  onNewCalculation: () => void;
}

const CalculationsList = React.memo(({
  calculations,
  selectedCalculation,
  onCalculationSelect,
  onCalculationDelete,
  onNewCalculation
}: CalculationsListProps) => {
  const { formatCurrency, formatPercentage } = mortgageCalculatorComponentService;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Your Calculations</h3>
        <button
          onClick={onNewCalculation}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          aria-label="New calculation"
        >
          <PlusIcon size={16} />
        </button>
      </div>
      
      <div className="space-y-3">
        {calculations.map((calc) => (
          <div
            key={calc.id}
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
              selectedCalculation?.id === calc.id
                ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => onCalculationSelect(calc)}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(calc.loan_amount)}
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCalculationDelete(calc);
                }}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                aria-label="Delete calculation"
              >
                <TrashIcon size={14} />
              </button>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>{formatPercentage(calc.interest_rate)} • {calc.term_years} years</div>
              <div>{formatCurrency(calc.monthly_payment)}/month</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

CalculationsList.displayName = 'CalculationsList';

export default CalculationsList;