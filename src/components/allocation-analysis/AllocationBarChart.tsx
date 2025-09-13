import React, { useEffect, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { COLORS } from './types';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { logger } from '../../services/loggingService';

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: {
    name: string;
    current: number;
    target: number;
    amount: number;
    color: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

interface AllocationBarChartProps {
  allocations: AssetAllocation[];
  showTargets: boolean;
  formatCurrency: (value: number) => string;
}

export const AllocationBarChart = memo(function AllocationBarChart({
  allocations,
  showTargets,
  formatCurrency
}: AllocationBarChartProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationBarChart component initialized', {
      componentName: 'AllocationBarChart'
    });
  }, []);

  const data = allocations.map((alloc, index) => ({
    name: alloc.assetClass,
    current: alloc.currentPercent,
    target: showTargets ? alloc.targetPercent : 0,
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
            Current: {(data?.current ?? 0).toFixed(1)}%
          </p>
          {showTargets && data && data.target > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Target: {(data?.target ?? 0).toFixed(1)}%
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Value: {formatCurrency(data?.amount ?? 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="current" name="Current %" fill="#3B82F6">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
        {showTargets && (
          <Bar dataKey="target" name="Target %" fill="#E5E7EB" />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
});