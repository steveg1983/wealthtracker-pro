/**
 * Forecast Chart Component
 * World-class financial visualization with Bloomberg Terminal-level precision
 */

import React, { useEffect, memo } from 'react';
import { DynamicPieChart, DynamicBarChart, DynamicLineChart, DynamicAreaChart, DynamicTreemap } from '../../charts/ChartMigration';
import { cashFlowService } from '../../services/cashflow/cashFlowService';
import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

interface ForecastChartProps {
  data: Array<{
    date: string;
    balance: number;
    income: number;
    expenses: number;
    confidence: number;
  }>;
  formatCurrency: (value: DecimalInstance) => string;
}

/**
 * Premium forecast chart with institutional styling
 */
export const ForecastChart = memo(function ForecastChart({ data,
  formatCurrency
 }: ForecastChartProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ForecastChart component initialized', {
      componentName: 'ForecastChart'
    });
  }, []);

  const config = cashFlowService.getChartConfig();

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <ChartHeader />
      <ChartContainer>
        <DynamicAreaChart
          data={data}
          xDataKey="date"
          yDataKeys={['balance']}
          height={200}
        />
      </ChartContainer>
    </div>
  );
});

/**
 * Chart header
 */
const ChartHeader = memo(function ChartHeader(): React.JSX.Element {
  return (
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      Balance Projection
    </h3>
  );
});

/**
 * Chart container
 */
const ChartContainer = memo(function ChartContainer({
  children
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const logger = useLogger();
  return <div className="h-80">{children}</div>;
});

/**
 * Chart gradient definition
 */
const ChartGradient = memo(function ChartGradient({
  gradientId
}: {
  gradientId: string;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8}/>
        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
      </linearGradient>
    </defs>
  );
});

/**
 * Chart tooltip
 */
const ChartTooltip = memo(function ChartTooltip({
  formatCurrency
}: {
  formatCurrency: (value: DecimalInstance) => string;
}): React.JSX.Element {
  return (
    <Tooltip 
      formatter={(value: number) => cashFlowService.formatChartCurrency(value, formatCurrency)}
      contentStyle={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #ccc',
        borderRadius: '8px'
      }}
    />
  );
});