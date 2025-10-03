import React, { memo, useEffect, useMemo } from 'react';
import { DynamicPieChart, DynamicBarChart, DynamicLineChart, DynamicAreaChart, DynamicTreemap } from '../../charts/ChartMigration';
import type { EfficientFrontierPoint } from '../../../services/portfolioOptimizationService';
import { useLogger } from '../services/ServiceProvider';

interface EfficientFrontierChartProps {
  efficientFrontier: EfficientFrontierPoint[];
  currentPortfolio?: { return: number; risk: number } | null;
  optimalPortfolio: EfficientFrontierPoint | null;
  selectedPoint: EfficientFrontierPoint | null;
  onPointClick: (point: EfficientFrontierPoint) => void;
}

/**
 * Efficient frontier chart component
 * Displays the efficient frontier curve with portfolio points
 */
export const EfficientFrontierChart = memo(function EfficientFrontierChart({ efficientFrontier,
  currentPortfolio,
  optimalPortfolio,
  selectedPoint,
  onPointClick
 }: EfficientFrontierChartProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EfficientFrontierChart component initialized', {
      componentName: 'EfficientFrontierChart'
    });
  }, []);

  // Build data arrays (percent scale to match existing visuals)
  const frontierData = useMemo(
    () => efficientFrontier.map(p => ({ risk: p.risk * 100, ret: p.return * 100 })),
    [efficientFrontier]
  );

  const currentData = currentPortfolio
    ? [{ risk: currentPortfolio.risk * 100, ret: currentPortfolio.return * 100 }]
    : [];
  const optimalData = optimalPortfolio
    ? [{ risk: optimalPortfolio.risk * 100, ret: optimalPortfolio.return * 100 }]
    : [];
  const selectedData = selectedPoint
    ? [{ risk: selectedPoint.risk * 100, ret: selectedPoint.return * 100 }]
    : [];

  const onFrontierPointClick = (index: number) => {
    // Map index back to efficientFrontier array
    if (efficientFrontier[index]) {
      onPointClick(efficientFrontier[index]);
    }
  };

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload as { risk: number; ret: number };
    return (
      <div className="rounded bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow">
        <div className="font-medium text-gray-900 dark:text-gray-100">Risk vs Return</div>
        <div className="text-gray-600 dark:text-gray-300">Risk: {p.risk.toFixed(2)}%</div>
        <div className="text-gray-600 dark:text-gray-300">Return: {p.ret.toFixed(2)}%</div>
      </div>
    );
  };

  return (
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={frontierData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="risk"
              type="number"
              tickFormatter={(v: number) => `${v}%`}
              label={{ value: 'Risk (Standard Deviation %)', position: 'insideBottom', offset: -2 }}
            />
            <YAxis
              dataKey="ret"
              type="number"
              tickFormatter={(v: number) => `${v}%`}
              label={{ value: 'Expected Return %', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={renderTooltip} />
            <Legend wrapperStyle={{ paddingBottom: 8 }} />

            {/* Efficient frontier line */}
            <Line name="Efficient Frontier" type="monotone" dataKey="ret" stroke="#3B82F6" strokeWidth={2} dot={false} />
            {/* Invisible scatter on frontier to capture clicks with same index */}
            <Scatter
              data={frontierData}
              fill="#3B82F6"
              opacity={0}
              onClick={(_, idx) => onFrontierPointClick(idx as number)}
            />

            {/* Current/Optimal/Selected markers */}
            {currentData.length > 0 && (
              <Scatter name="Current Portfolio" data={currentData} fill="#F59E0B" shape="triangle" />
            )}
            {optimalData.length > 0 && (
              <Scatter name="Optimal Portfolio" data={optimalData} fill="#10B981" shape="star" />
            )}
            {selectedData.length > 0 && (
              <Scatter name="Selected Portfolio" data={selectedData} fill="#8B5CF6" shape="circle" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        Click on the efficient frontier line to explore different portfolios
      </p>
    </div>
  );
});
