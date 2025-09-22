import React, { useEffect, memo } from 'react';
import { COLORS } from './types';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { useLogger } from '../services/ServiceProvider';

  name?: string;
  value?: number;
  payload?: {
    name: string;
    size: number;
    percent: number;
    color: string;
  };
}

  active?: boolean;
}

  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  percent?: number;
  color?: string;
  [key: string]: any;
}

  allocations: AssetAllocation[];
  formatCurrency: (value: number) => string;
}

  formatCurrency
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    });
  }, []);

  const data = allocations.map((alloc, index) => ({
    name: alloc.assetClass,
    size: typeof alloc.currentValue === 'number' ? alloc.currentValue : alloc.currentValue.toNumber(),
    percent: alloc.currentPercent,
    color: COLORS[index % COLORS.length]
  }));

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
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#fff"
        fill="#8884d8"
        content={CustomContent}
      >
  );
});