import React, { useEffect, memo } from 'react';
import { PieChartIcon } from '../icons';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

export interface AssetAllocation {
  category: string;
  value: DecimalInstance;
  percentage: number;
  targetPercentage: number;
  difference: number;
  color: string;
}

interface AssetAllocationChartProps {
  allocations: AssetAllocation[];
  formatCurrency: (value: DecimalInstance | number) => string;
}

export const AssetAllocationChart = memo(function AssetAllocationChart({
  allocations,
  formatCurrency
}: AssetAllocationChartProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AssetAllocationChart component initialized', {
      componentName: 'AssetAllocationChart'
    });
  }, []);

  const totalValue = allocations.reduce((sum, a) => sum.plus(a.value), allocations[0]?.value.minus(allocations[0]?.value) || 0);

  if (allocations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          No asset allocation data available.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
        <PieChartIcon className="text-blue-500" size={20} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart Visualization */}
        <div className="relative">
          <svg viewBox="0 0 200 200" className="w-full max-w-xs mx-auto">
            {(() => {
              let cumulativePercentage = 0;
              return allocations.map((allocation, index) => {
                const startAngle = (cumulativePercentage * 360) / 100;
                const endAngle = ((cumulativePercentage + allocation.percentage) * 360) / 100;
                cumulativePercentage += allocation.percentage;
                
                const x1 = 100 + 80 * Math.cos((startAngle * Math.PI) / 180);
                const y1 = 100 + 80 * Math.sin((startAngle * Math.PI) / 180);
                const x2 = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
                const y2 = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);
                
                const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
                
                return (
                  <path
                    key={allocation.category}
                    d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                    fill={allocation.color}
                    stroke="white"
                    strokeWidth="2"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <title>{allocation.category}: {allocation.percentage.toFixed(1)}%</title>
                  </path>
                );
              });
            })()}
          </svg>
        </div>

        {/* Allocation Details */}
        <div className="space-y-3">
          {allocations.map(allocation => (
            <div key={allocation.category} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: allocation.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {allocation.category}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(allocation.value)}
                </span>
              </div>
              
              <div className="ml-6">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500">Current</span>
                  <span className="text-xs font-medium">{allocation.percentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500">Target</span>
                  <span className="text-xs font-medium">{allocation.targetPercentage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Difference</span>
                  <span className={`text-xs font-medium ${
                    Math.abs(allocation.difference) > 5 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {allocation.difference >= 0 ? '+' : ''}{allocation.difference.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rebalancing Alert */}
      {allocations.some(a => Math.abs(a.difference) > 10) && (
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <span className="font-medium">Rebalancing recommended:</span> Some allocations deviate significantly from targets.
          </p>
        </div>
      )}
    </div>
  );
});