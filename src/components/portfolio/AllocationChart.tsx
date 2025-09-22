import React, { useEffect, memo } from 'react';
import { DynamicPieChart, DynamicBarChart, DynamicLineChart, DynamicAreaChart, DynamicTreemap } from '../../charts/ChartMigration';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { useLogger } from '../services/ServiceProvider';

interface AllocationChartProps {
  allocations: AssetAllocation[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

export const AllocationChart = memo(function AllocationChart({ allocations  }: AllocationChartProps): React.JSX.Element {
  const logger = useLogger();
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
    <DynamicPieChart
          data={chartData}
          dataKey="value"
          nameKey="name"
          
          outerRadius={100}
          height={200}
        />
  );
});

export { COLORS };