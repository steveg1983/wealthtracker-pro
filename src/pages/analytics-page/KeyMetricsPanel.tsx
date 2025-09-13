import { memo } from 'react';
import { 
  ArrowUpRightIcon, 
  ArrowDownRightIcon,
  TrendingUpIcon,
  BarChart3Icon 
} from '../../components/icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { KeyMetrics } from './types';

interface KeyMetricsPanelProps {
  metrics: KeyMetrics;
}

/**
 * Panel displaying key financial metrics
 * Shows income, expenses, savings rate, and transaction count
 */
export const KeyMetricsPanel = memo(function KeyMetricsPanel({ metrics }: KeyMetricsPanelProps) {
  const { formatCurrency } = useCurrencyDecimal();

  const metricCards = [
    {
      label: 'Total Income',
      value: formatCurrency(metrics.totalIncome),
      icon: ArrowUpRightIcon,
      color: 'green',
      iconColor: 'text-green-500'
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(metrics.totalExpenses),
      icon: ArrowDownRightIcon,
      color: 'red',
      iconColor: 'text-red-500'
    },
    {
      label: 'Savings Rate',
      value: `${metrics.savingsRate.toFixed(1)}%`,
      icon: TrendingUpIcon,
      color: 'gray',
      iconColor: 'text-gray-500'
    },
    {
      label: 'Transactions',
      value: metrics.transactionCount.toString(),
      icon: BarChart3Icon,
      color: 'purple',
      iconColor: 'text-purple-500'
    }
  ];

  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{metric.label}</p>
                  <p className={`text-2xl font-bold text-${metric.color}-600 dark:text-${metric.color}-400`}>
                    {metric.value}
                  </p>
                </div>
                <Icon className={metric.iconColor} size={24} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});