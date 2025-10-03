import React, { useEffect, memo } from 'react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from '../charts/OptimizedCharts';
import { useLogger } from '../services/ServiceProvider';

interface HoldingsChartProps {
  holdings: Array<{
    name: string;
    value: number;
    allocation: number;
    return: number;
    ticker: string;
  }>;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export const HoldingsChart = memo(function HoldingsChart({ holdings,
  formatCurrency,
  formatPercentage
 }: HoldingsChartProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HoldingsChart component initialized', {
      componentName: 'HoldingsChart'
    });
  }, []);

  // Sort holdings by value for better visualization
  const sortedHoldings = [...holdings].sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <h3 className="text-lg font-semibold text-theme-heading dark:text-white mb-4">Holdings</h3>
      
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Pie Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={sortedHoldings}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => entry.allocation > 5 ? `${entry.name} (${formatPercentage(entry.allocation)})` : ''}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {sortedHoldings.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        {/* Holdings List */}
        <div className="flex-1 space-y-2">
          {sortedHoldings.slice(0, 5).map((holding, index) => (
            <div key={holding.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div>
                  <p className="font-medium text-theme-heading dark:text-white">{holding.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{holding.ticker}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-theme-heading dark:text-white">{formatCurrency(holding.value)}</p>
                <p className={`text-xs ${holding.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {holding.return >= 0 ? '+' : ''}{formatPercentage(holding.return)}
                </p>
              </div>
            </div>
          ))}
          {holdings.length > 5 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
              +{holdings.length - 5} more holdings
            </p>
          )}
        </div>
      </div>
    </div>
  );
});