/**
 * Forecast Chart Component
 * World-class financial visualization with Bloomberg Terminal-level precision
 */

import React, { useEffect, memo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cashFlowService } from '../../services/cashflow/cashFlowService';
import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

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
export const ForecastChart = memo(function ForecastChart({
  data,
  formatCurrency
}: ForecastChartProps): React.JSX.Element {
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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={config.margin}>
            <ChartGradient gradientId={config.gradientId} />
            <CartesianGrid strokeDasharray="3 3" stroke={config.gridColor} />
            <XAxis 
              dataKey="date" 
              stroke={config.axisColor}
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke={config.axisColor}
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => cashFlowService.formatChartCurrency(value, formatCurrency)}
            />
            <ChartTooltip formatCurrency={formatCurrency} />
            <ReferenceLine y={0} stroke="#ff0000" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${config.gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
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