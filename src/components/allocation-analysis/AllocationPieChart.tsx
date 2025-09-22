import React, { useEffect, memo } from 'react';
import { DynamicPieChart, DynamicBarChart, DynamicLineChart, DynamicAreaChart, DynamicTreemap } from '../../charts/ChartMigration';
import { COLORS } from './types';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { useLogger } from '../services/ServiceProvider';

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: {
    name: string;
    value: number;
    amount: number;
    color: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

interface AllocationPieChartProps {
  allocations: AssetAllocation[];
  showTargets: boolean;
  formatCurrency: (value: number) => string;
}

export const AllocationPieChart = memo(function AllocationPieChart({ allocations,
  showTargets,
  formatCurrency
 }: AllocationPieChartProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationPieChart component initialized', {
      componentName: 'AllocationPieChart'
    });
  }, []);

  const data = allocations.map((alloc, index) => ({
    name: alloc.assetClass,
    value: alloc.currentPercent,
    amount: typeof alloc.currentValue === 'number' ? alloc.currentValue : alloc.currentValue.toNumber(),
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload[0] && payload[0].payload) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">{data?.name || 'Unknown'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {(data?.value ?? 0).toFixed(1)}% • {formatCurrency(data?.amount ?? 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <DynamicPieChart
          data={data}
          dataKey="value"
          nameKey="name"
          
          outerRadius={120}
          height={200}
        />
  );
});