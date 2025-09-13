import React, { useEffect, memo } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { ClockIcon, AlertCircleIcon, RepeatIcon } from '../icons';
import type { DecimalInstance } from '../../utils/decimal';
import { logger } from '../../services/loggingService';

interface BillSummaryCardsProps {
  upcomingCount: number;
  overdueCount: number;
  totalCount: number;
  totalUpcoming: DecimalInstance;
  totalOverdue: DecimalInstance;
}

export const BillSummaryCards = memo(function BillSummaryCards({
  upcomingCount,
  overdueCount,
  totalCount,
  totalUpcoming,
  totalOverdue
}: BillSummaryCardsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BillSummaryCards component initialized', {
      componentName: 'BillSummaryCards'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SummaryCard
        title="Upcoming Bills"
        count={upcomingCount}
        amount={formatCurrency(totalUpcoming)}
        icon={<ClockIcon className="text-blue-500" size={24} />}
        countClassName="text-gray-900 dark:text-white"
      />
      
      <SummaryCard
        title="Overdue Bills"
        count={overdueCount}
        amount={formatCurrency(totalOverdue)}
        icon={<AlertCircleIcon className="text-red-500" size={24} />}
        countClassName="text-red-600 dark:text-red-400"
      />
      
      <SummaryCard
        title="Total Bills"
        count={totalCount}
        subtitle="Active bills"
        icon={<RepeatIcon className="text-green-500" size={24} />}
        countClassName="text-gray-900 dark:text-white"
      />
    </div>
  );
});

interface SummaryCardProps {
  title: string;
  count: number;
  amount?: string;
  subtitle?: string;
  icon: React.ReactNode;
  countClassName: string;
}

const SummaryCard = memo(function SummaryCard({
  title,
  count,
  amount,
  subtitle,
  icon,
  countClassName
}: SummaryCardProps) {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold ${countClassName}`}>
            {count}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {amount || subtitle || ''}
          </p>
        </div>
        {icon}
      </div>
    </div>
  );
});