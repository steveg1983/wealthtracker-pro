import { memo, useEffect } from 'react';
import { InfoIcon } from '../../icons';
import { StateTaxCalculatorService } from '../../../services/stateTaxCalculatorService';
import type { RetirementIncome } from '../../../services/stateTaxService';
import { useLogger } from '../services/ServiceProvider';

interface IncomeInputSectionProps {
  income: RetirementIncome;
  onChange: (field: keyof RetirementIncome, value: string) => void;
  formatCurrency: (amount: any) => string;
}

export const IncomeInputSection = memo(function IncomeInputSection({ income,
  onChange,
  formatCurrency
 }: IncomeInputSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('IncomeInputSection component initialized', {
      componentName: 'IncomeInputSection'
    });
  }, []);

  const labels = StateTaxCalculatorService.getIncomeFieldLabels();
  const descriptions = StateTaxCalculatorService.getIncomeFieldDescriptions();
  const totalIncome = StateTaxCalculatorService.calculateTotalIncome(income);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Retirement Income Sources
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(income).map(([field, value]) => (
          <div key={field}>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              {labels[field as keyof RetirementIncome]}
              <button
                type="button"
                className="ml-1 text-gray-400 hover:text-gray-600"
                title={descriptions[field as keyof RetirementIncome]}
              >
                <InfoIcon size={14} />
              </button>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                value={value || ''}
                onChange={(e) => onChange(field as keyof RetirementIncome, e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Annual Income:
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalIncome)}
          </span>
        </div>
      </div>
    </div>
  );
});