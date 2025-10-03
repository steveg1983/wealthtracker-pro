import { memo, useEffect } from 'react';
import { BarChart3Icon, PieChartIcon } from '../../icons';
import {
  PieChart as RcPieChart,
  BarChart as RcBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  Bar,
  Cell
} from '../../charts/OptimizedCharts';
import type { NetWorthDataPoint, PieDataPoint } from '../../../services/improvedDashboardService';
import { useLogger } from '../services/ServiceProvider';

interface DashboardChartsProps {
  netWorthData: NetWorthDataPoint[];
  pieData: PieDataPoint[];
  netWorth: number;
  chartStyles: any;
  formatCurrency: (amount: number) => string;
  displayCurrency: string;
  onAccountClick: (accountId: string) => void;
}

/**
 * Dashboard charts component
 */
export const DashboardCharts = memo(function DashboardCharts({ netWorthData,
  pieData,
  netWorth,
  chartStyles,
  formatCurrency,
  displayCurrency,
  onAccountClick
 }: DashboardChartsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardCharts component initialized', {
      componentName: 'DashboardCharts'
    });
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <>
      {/* Net Worth Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3Icon size={24} className="text-gray-500" />
          Net Worth Over Time
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {netWorthData.length === 1 
            ? "Current month's net worth (historical data will build up over time)"
            : "Your wealth progression over time"
          }
        </p>
        <div className="h-64">
          {netWorthData.length === 1 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <BarChart3Icon size={48} className="opacity-20 mb-3" />
              <p className="text-lg font-medium mb-2">Current Net Worth</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(netWorth)}
              </p>
              <p className="text-sm mt-3 text-center max-w-md">
                As you continue using WealthTracker, we'll track your net worth over time 
                to show you trends and progress towards your financial goals.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RcBarChart data={netWorthData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value: number) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return String(value);
                }} />
                <Tooltip 
                  contentStyle={chartStyles.tooltip} 
                  formatter={(value: number) => [
                    formatCurrency(Number(value)),
                    'Net Worth'
                  ]}
                />
                <Bar dataKey="netWorth" fill="#8B5CF6" radius={[4,4,0,0]} />
              </RcBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Account Distribution Chart */}
      {pieData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" />
            Account Distribution
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your top 5 accounts by balance
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RcPieChart>
                <Tooltip 
                  contentStyle={chartStyles.pieTooltip}
                  formatter={(value: number) => [
                    formatCurrency(Number(value)),
                    ''
                  ]}
                />
                <Pie 
                  data={pieData} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius="60%"
                  onClick={(data: any) => {
                    if (data?.payload?.id) {
                      onAccountClick(data.payload.id);
                    }
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </RcPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
});