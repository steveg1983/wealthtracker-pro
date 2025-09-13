import React, { useEffect, memo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { COLORS } from './types';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { logger } from '../../services/loggingService';

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: {
    name: string;
    size: number;
    percent: number;
    color: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  percent?: number;
  color?: string;
  [key: string]: any;
}

interface AllocationTreemapProps {
  allocations: AssetAllocation[];
  formatCurrency: (value: number) => string;
}

export const AllocationTreemap = memo(function AllocationTreemap({
  allocations,
  formatCurrency
}: AllocationTreemapProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationTreemap component initialized', {
      componentName: 'AllocationTreemap'
    });
  }, []);

  const data = allocations.map((alloc, index) => ({
    name: alloc.assetClass,
    size: typeof alloc.currentValue === 'number' ? alloc.currentValue : alloc.currentValue.toNumber(),
    percent: alloc.currentPercent,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload[0] && payload[0].payload) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">{data?.name || 'Unknown'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {(data?.percent ?? 0).toFixed(1)}% • {formatCurrency(data?.size ?? 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomContent = (props: TreemapContentProps) => {
    const { x = 0, y = 0, width = 0, height = 0, name = '', percent = 0, color = '#8884d8' } = props;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: '#fff',
            strokeWidth: 2,
            strokeOpacity: 1,
          }}
        />
        {width > 60 && height > 40 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 10}
              fill="#fff"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-sm font-semibold"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              fill="#fff"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs"
            >
              {percent.toFixed(1)}%
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#fff"
        fill="#8884d8"
        content={CustomContent}
      >
        <Tooltip content={<CustomTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
});