import { memo, useEffect } from 'react';
import {
  PiggyBankIcon,
  TrendingUpIcon,
  CalculatorIcon,
  InfoIcon
} from '../../icons';
import { SIPPCalculatorService } from '../../../services/sippCalculatorService';
import { useLogger } from '../services/ServiceProvider';

interface SIPPSummaryCardsProps {
  finalBalance: number;
  totalTaxRelief: number;
  retirementAge: number;
  taxReliefRate: number;
  formatCurrency: (amount: number) => string;
}

/**
 * SIPP summary cards component
 */
export const SIPPSummaryCards = memo(function SIPPSummaryCards({ finalBalance,
  totalTaxRelief,
  retirementAge,
  taxReliefRate,
  formatCurrency
 }: SIPPSummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SIPPSummaryCards component initialized', {
      componentName: 'SIPPSummaryCards'
    });
  }, []);

  const { taxFreeLumpSum } = SIPPCalculatorService.calculateTaxFreeAmounts(finalBalance);
  const monthlyIncome = SIPPCalculatorService.getSustainableMonthlyIncome(finalBalance);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <PiggyBankIcon size={16} className="text-gray-600 dark:text-gray-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Projected Balance</p>
        </div>
        <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
          {formatCurrency(finalBalance)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          At age {retirementAge}
        </p>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUpIcon size={16} className="text-green-600 dark:text-green-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Tax Relief</p>
        </div>
        <p className="text-xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(totalTaxRelief)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {(taxReliefRate * 100).toFixed(0)}% relief on contributions
        </p>
      </div>

      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalculatorIcon size={16} className="text-purple-600 dark:text-purple-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">25% Tax-Free</p>
        </div>
        <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
          {formatCurrency(taxFreeLumpSum)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Available from age {SIPPCalculatorService.MINIMUM_PENSION_AGE}
        </p>
      </div>

      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <InfoIcon size={16} className="text-orange-600 dark:text-orange-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Income (4%)</p>
        </div>
        <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
          {formatCurrency(monthlyIncome)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Sustainable withdrawal
        </p>
      </div>
    </div>
  );
});