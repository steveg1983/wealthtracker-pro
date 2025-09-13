import React, { useEffect, memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { logger } from '../../services/loggingService';

interface AllocationChartProps {
  allocations: AssetAllocation[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

export const AllocationChart = memo(function AllocationChart({ allocations }: AllocationChartProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationChart component initialized', {
      componentName: 'AllocationChart'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  const chartData = allocations.map(alloc => ({
    name: alloc.assetClass,
    value: alloc.currentValue.toNumber(),
    percent: alloc.currentPercent
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">No holdings to display</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent ?? 0).toFixed(1)}%`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(value as number)} />
      </PieChart>
    </ResponsiveContainer>
  );
});

export { COLORS };