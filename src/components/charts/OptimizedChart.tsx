import React, { memo, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

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
        <ResponsiveContainer width={width} height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {data.datasets?.map((dataset, idx) => (
              <Line
                key={dataset.label || idx}
                type="monotone"
                dataKey={dataset.label || 'value'}
                stroke={typeof dataset.borderColor === 'string' ? dataset.borderColor : COLORS[idx % COLORS.length]}
                fill={typeof dataset.backgroundColor === 'string' ? dataset.backgroundColor : COLORS[idx % COLORS.length]}
                strokeWidth={dataset.borderWidth || 2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
      
    case 'bar':
      return (
        <ResponsiveContainer width={width} height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {data.datasets?.map((dataset, idx) => (
              <Bar
                key={dataset.label || idx}
                dataKey={dataset.label || 'value'}
                fill={typeof dataset.backgroundColor === 'string' ? dataset.backgroundColor : COLORS[idx % COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
      
    case 'pie':
    case 'doughnut':
      const pieData = data.labels?.map((label, index) => ({
        name: label,
        value: dataset?.data?.[index] || 0
      })) || [];
      
      return (
        <ResponsiveContainer width={width} height={height}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => entry.name}
              outerRadius={type === 'doughnut' ? 80 : 60}
              innerRadius={type === 'doughnut' ? 40 : 0}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    Array.isArray(dataset?.backgroundColor) 
                      ? dataset.backgroundColor[index % dataset.backgroundColor.length]
                      : COLORS[index % COLORS.length]
                  } 
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
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