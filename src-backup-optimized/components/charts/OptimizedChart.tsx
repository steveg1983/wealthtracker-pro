import React, { memo, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import {
  DynamicLineChart,
  DynamicBarChart,
  DynamicPieChart
} from './ChartMigration';

// Type definitions for compatibility with Chart.js-like API
interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: any;
    title?: any;
    tooltip?: any;
  };
  scales?: any;
}

interface ChartData {
  labels?: string[];
  datasets?: Array<{
    label?: string;
    data?: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
}

interface OptimizedChartProps {
  type: 'line' | 'bar' | 'doughnut' | 'pie';
  data: ChartData;
  options?: ChartOptions;
  height?: number;
  width?: number | string;
  className?: string;
  lazyLoad?: boolean;
  throttleRedraw?: number;
}

// Color palette for charts
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Convert Chart.js data format to Recharts format
const convertToRechartsData = (data: ChartData) => {
  if (!data.labels || !data.datasets) return [];
  
  return data.labels.map((label, index) => {
    const point: any = { name: label };
    data.datasets?.forEach((dataset) => {
      point[dataset.label || 'value'] = dataset.data?.[index] || 0;
    });
    return point;
  });
};

// Chart component implementation
const ChartComponent = memo<OptimizedChartProps>(({ 
  type, 
  data, 
  options, 
  height = 200, 
  width = '100%' 
}) => {
  const chartData = useMemo(() => convertToRechartsData(data), [data]);
  const dataset = data.datasets?.[0];
  
  switch (type) {
    case 'line':
      return (
        <DynamicLineChart
          data={chartData}
          xDataKey="name"
          yDataKeys={['value']}
          height={200}
        />
      );
      
    case 'bar':
      return (
        <DynamicBarChart
          data={chartData}
          xDataKey="name"
          yDataKeys={['value']}
          height={200}
        />
      );
      
    case 'pie':
    case 'doughnut':
      const pieData = data.labels?.map((label, index) => ({
        name: label,
        value: dataset?.data?.[index] || 0
      })) || [];
      
      return (
        <DynamicPieChart
          data={pieData}
          dataKey="value"
          nameKey="name"
          innerRadius={type === 'doughnut' ? 40 : 0}
          outerRadius={type === 'doughnut' ? 80 : 60}
          height={200}
        />
      );
      
    default:
      return null;
  }
});

ChartComponent.displayName = 'ChartComponent';

// Main optimized chart component with lazy loading
export const OptimizedChart: React.FC<OptimizedChartProps> = memo(({
  type,
  data,
  options,
  height = 200,
  width,
  className = '',
  lazyLoad = true,
  throttleRedraw = 100
}) => {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
    rootMargin: '50px'
  });
  
  // Show placeholder while not in view
  if (lazyLoad && !inView) {
    return (
      <div 
        ref={ref} 
        className={`flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}
        style={{ height, width: width || '100%' }}
      >
        <div className="text-gray-400">Chart will load when visible</div>
      </div>
    );
  }
  
  return (
    <div ref={ref} className={className}>
      <ChartComponent 
        type={type} 
        data={data} 
        options={options} 
        height={height} 
        width={width} 
      />
    </div>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;