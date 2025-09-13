import React, { useEffect, memo } from 'react';
import { BarChart3Icon } from '../icons';
import type { NetWorthProjection } from './types';
import { logger } from '../../services/loggingService';

interface ProjectionChartProps {
  projection: NetWorthProjection | null;
  formatCurrency: (value: number) => string;
}

export const ProjectionChart = memo(function ProjectionChart({
  projection,
  formatCurrency
}: ProjectionChartProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ProjectionChart component initialized', {
      componentName: 'ProjectionChart'
    });
  }, []);

  if (!projection) return <></>;

  const maxValue = Math.max(...projection.projectionYears.map(y => y.netWorth));
  const minValue = Math.min(...projection.projectionYears.map(y => y.netWorth), 0);
  const range = maxValue - minValue;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BarChart3Icon size={20} />
        Net Worth Projection
      </h3>

      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Current</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(projection.currentNetWorth)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Projected ({projection.projectionYears[projection.projectionYears.length - 1].year})
            </p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(projection.projectedNetWorth)}
            </p>
          </div>
        </div>
      </div>

      {/* Simple bar chart visualization */}
      <div className="relative h-64">
        <div className="absolute inset-0 flex items-end justify-between gap-2">
          {projection.projectionYears.map((year, index) => {
            const height = ((year.netWorth - minValue) / range) * 100;
            const isPositive = year.netWorth >= 0;
            
            return (
              <div
                key={year.year}
                className="flex-1 flex flex-col items-center justify-end"
                title={`${year.year}: ${formatCurrency(year.netWorth)}`}
              >
                <div
                  className={`w-full transition-all duration-500 rounded-t ${
                    isPositive
                      ? 'bg-gradient-to-t from-green-600 to-green-400'
                      : 'bg-gradient-to-t from-red-600 to-red-400'
                  }`}
                  style={{ height: `${Math.abs(height)}%` }}
                />
                {index % Math.ceil(projection.projectionYears.length / 5) === 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {year.year}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Zero line if there are negative values */}
        {minValue < 0 && (
          <div
            className="absolute left-0 right-0 border-t border-gray-400 dark:border-gray-600"
            style={{ bottom: `${(Math.abs(minValue) / range) * 100}%` }}
          >
            <span className="absolute -top-2.5 left-0 text-xs text-gray-500">0</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <p className="text-gray-600 dark:text-gray-400">Monthly Contribution</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(projection.monthlyChange)}
          </p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <p className="text-gray-600 dark:text-gray-400">Total Growth</p>
          <p className="font-medium text-green-600 dark:text-green-400">
            {formatCurrency(projection.projectedNetWorth - projection.currentNetWorth)}
          </p>
        </div>
      </div>
    </div>
  );
});