import React, { useEffect, memo } from 'react';
import { SkeletonText } from '../loading/Skeleton';
import type { ReportSummary } from '../../services/reportsPageService';
import { useLogger } from '../services/ServiceProvider';

interface SummaryCardsProps {
  summary: ReportSummary;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
  getSavingsRateColor: (rate: number) => string;
  getNetIncomeColor: (amount: number) => string;
}

const SummaryCards = memo(function SummaryCards({ summary,
  isLoading,
  formatCurrency,
  getSavingsRateColor,
  getNetIncomeColor
 }: SummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SummaryCards component initialized', {
      componentName: 'SummaryCards'
    });
  }, []);
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <SummaryCard
        title="Total Income"
        value={isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.income)}
        valueColor="text-green-600 dark:text-green-400"
      />
      
      <SummaryCard
        title="Total Expenses"
        value={isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.expenses)}
        valueColor="text-red-600 dark:text-red-400"
      />
      
      <SummaryCard
        title="Net Income"
        value={isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.netIncome)}
        valueColor={getNetIncomeColor(summary.netIncome)}
      />
      
      <SummaryCard
        title="Savings Rate"
        value={isLoading ? <SkeletonText className="w-20 h-8" /> : `${summary.savingsRate.toFixed(1)}%`}
        valueColor={getSavingsRateColor(summary.savingsRate)}
      />
    </div>
  );
});

// Summary Card Sub-component
const SummaryCard = memo(function SummaryCard({
  title,
  value,
  valueColor
}: {
  title: string;
  value: React.ReactNode;
  valueColor: string;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>
        {value}
      </p>
    </div>
  );
});

export default SummaryCards;