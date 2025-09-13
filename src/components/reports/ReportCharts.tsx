import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, PieChartIcon } from '../icons';
import { SkeletonCard } from '../loading/Skeleton';
import { Line as LazyLineChart, Doughnut as LazyDoughnutChart } from 'react-chartjs-2';
import type { ChartData } from '../../services/reportsPageService';
import { logger } from '../../services/loggingService';

interface ReportChartsProps {
  monthlyTrendData: ChartData;
  categoryData: ChartData;
  isLoading: boolean;
  chartRef1: React.RefObject<HTMLDivElement>;
  chartRef2: React.RefObject<HTMLDivElement>;
}

const ReportCharts = memo(function ReportCharts({
  monthlyTrendData,
  categoryData,
  isLoading,
  chartRef1,
  chartRef2
}: ReportChartsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportCharts component initialized', {
      componentName: 'ReportCharts'
    });
  }, []);
  return (
    <div className="pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <ChartCard
          title="Income vs Expenses Trend"
          icon={<TrendingUpIcon size={20} />}
          chartRef={chartRef1}
          isLoading={isLoading}
        >
          <LazyLineChart
            data={monthlyTrendData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom'
                }
              },
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }}
          />
        </ChartCard>

        {/* Category Breakdown Chart */}
        <ChartCard
          title="Expense Categories"
          icon={<PieChartIcon size={20} />}
          chartRef={chartRef2}
          isLoading={isLoading}
        >
          <LazyDoughnutChart
            data={categoryData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'right'
                }
              }
            }}
          />
        </ChartCard>
      </div>
    </div>
  );
});

// Chart Card Sub-component
const ChartCard = memo(function ChartCard({
  title,
  icon,
  chartRef,
  isLoading,
  children
}: {
  title: string;
  icon: React.ReactNode;
  chartRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-heading dark:text-white">
        {icon}
        {title}
      </h2>
      <div className="h-64" ref={chartRef}>
        {isLoading ? (
          <SkeletonCard className="h-full w-full" />
        ) : (
          children
        )}
      </div>
    </div>
  );
});

export default ReportCharts;