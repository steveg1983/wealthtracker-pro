import React, { useEffect, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from '../charts/OptimizedCharts';
import { useLogger } from '../services/ServiceProvider';

interface PerformanceChartProps {
  data: Array<{ month: string; value: number }>;
  formatCurrency: (value: number) => string;
  selectedPeriod: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  onPeriodChange: (period: '1M' | '3M' | '6M' | '1Y' | 'ALL') => void;
}

export const PerformanceChart = memo(function PerformanceChart({ data,
  formatCurrency,
  selectedPeriod,
  onPeriodChange
 }: PerformanceChartProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PerformanceChart component initialized', {
      componentName: 'PerformanceChart'
    });
  }, []);

  const periods: Array<'1M' | '3M' | '6M' | '1Y' | 'ALL'> = ['1M', '3M', '6M', '1Y', 'ALL'];

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-theme-heading dark:text-white">Performance</h3>
        <div className="flex gap-1">
          {periods.map(period => (
            <button
              key={period}
              onClick={() => onPeriodChange(period)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
          <XAxis dataKey="month" />
          <YAxis 
            tickFormatter={(value: any) => {
              const formatted = formatCurrency(value);
              if (value >= 1000) {
                return `${formatted.charAt(0)}${(value / 1000).toFixed(0)}k`;
              }
              return formatted;
            }}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});