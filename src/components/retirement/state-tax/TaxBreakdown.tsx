import { memo, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { StateTaxCalculatorService } from '../../../services/stateTaxCalculatorService';
import type { StateTaxCalculation } from '../../../services/stateTaxService';
import { useLogger } from '../services/ServiceProvider';

interface TaxBreakdownProps {
  calculation: StateTaxCalculation;
  isExpanded: boolean;
  onToggle: () => void;
  formatCurrency: (amount: any) => string;
}

export const TaxBreakdown = memo(function TaxBreakdown({ calculation,
  isExpanded,
  onToggle,
  formatCurrency
 }: TaxBreakdownProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TaxBreakdown component initialized', {
      componentName: 'TaxBreakdown'
    });
  }, []);

  const categories = StateTaxCalculatorService.getTaxBreakdownCategories(calculation.breakdown);
  const effectiveRate = StateTaxCalculatorService.getEffectiveTaxRate(calculation);

  return (
    <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tax Calculation Breakdown
        </h4>
        {isExpanded ? (
          <ChevronUpIcon size={20} className="text-gray-400" />
        ) : (
          <ChevronDownIcon size={20} className="text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {categories.map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {category.label}
              </span>
              <span className={`text-sm font-medium ${
                category.type === 'deduction' ? 'text-green-600' : 'text-gray-900 dark:text-white'
              }`}>
                {category.type === 'deduction' && '-'}
                {formatCurrency(Math.abs(category.amount))}
              </span>
            </div>
          ))}
          
          <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Taxable Income
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {formatCurrency(calculation.taxableIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                State Tax
              </span>
              <span className={`text-sm font-bold ${
                StateTaxCalculatorService.getTaxRateColor(effectiveRate)
              }`}>
                {formatCurrency(calculation.stateTax)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Effective Tax Rate
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {effectiveRate.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});