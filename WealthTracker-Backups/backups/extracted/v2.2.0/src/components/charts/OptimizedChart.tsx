import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
// Local in-view hook to avoid external dependency
function useSimpleInView(options: { threshold?: number; rootMargin?: string; triggerOnce?: boolean } = {}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          if (options.triggerOnce) obs.disconnect();
        } else if (!options.triggerOnce) {
          setInView(false);
        }
      },
      { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options.threshold, options.rootMargin, options.triggerOnce]);
  return { ref, inView } as const;
}
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface OptimizedChartProps {
  type: 'line' | 'bar' | 'doughnut' | 'pie';
  data: ChartData<'line' | 'bar' | 'doughnut' | 'pie'>;
  options?: ChartOptions<'line' | 'bar' | 'doughnut' | 'pie'>;
  height?: number;
  width?: number;
  className?: string;
  lazyLoad?: boolean;
  throttleRedraw?: number;
}

// Chart skeleton loader
const ChartSkeleton = memo(({ height = 200 }: { height?: number }) => (
  <div 
    className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg"
    style={{ height: `${height}px` }}
  >
    <div className="h-full flex items-center justify-center">
      <div className="space-y-2">
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
      </div>
    </div>
  </div>
));

// Memoized chart component
const MemoizedChart = memo(({ 
  type, 
  data, 
  options, 
  height, 
  width 
}: OptimizedChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Optimize chart options with defaults
  const optimizedOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300, // Faster animations
      easing: 'easeInOutQuart' as const
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 10,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        enabled: true,
        intersect: false,
        mode: 'index' as const,
        animation: {
          duration: 150
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    },
    ...options
  }), [options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup handled by React and chart components; ensure ref released
      // Prevent calling methods on non-chart elements
      (chartRef as any).current = null;
    };
  }, []);

  const chartProps: any = {
    ref: chartRef,
    data,
    options: optimizedOptions,
    height,
    width
  };

  switch (type) {
    case 'line':
      return <Line {...(chartProps as any)} />;
    case 'bar':
      return <Bar {...(chartProps as any)} />;
    case 'doughnut':
      return <Doughnut {...(chartProps as any)} />;
    case 'pie':
      return <Pie {...(chartProps as any)} />;
    default:
      return null;
  }
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    prevProps.type === nextProps.type &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) &&
    JSON.stringify(prevProps.options) === JSON.stringify(nextProps.options) &&
    prevProps.height === nextProps.height &&
    prevProps.width === nextProps.width
  );
});

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
  const { ref, inView } = useSimpleInView({
    threshold: 0.1,
    triggerOnce: true, // Only load once when scrolled into view
    rootMargin: '50px' // Start loading 50px before visible
  });
  
  const [isLoaded, setIsLoaded] = useState(!lazyLoad);
  const [throttledData, setThrottledData] = useState(data);
  const lastUpdateTime = useRef(Date.now());

  // Throttle data updates to prevent excessive re-renders
  useEffect(() => {
    if (throttleRedraw > 0) {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;
      
      if (timeSinceLastUpdate >= throttleRedraw) {
        setThrottledData(data);
        lastUpdateTime.current = now;
      } else {
        const timeout = setTimeout(() => {
          setThrottledData(data);
          lastUpdateTime.current = Date.now();
        }, throttleRedraw - timeSinceLastUpdate);
        
        return () => clearTimeout(timeout);
      }
    } else {
      setThrottledData(data);
    }
  }, [data, throttleRedraw]);

  // Handle lazy loading
  useEffect(() => {
    if (lazyLoad && inView && !isLoaded) {
      // Use requestIdleCallback for non-critical chart loading
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          setIsLoaded(true);
        });
      } else {
        setTimeout(() => {
          setIsLoaded(true);
        }, 0);
      }
    }
  }, [inView, lazyLoad, isLoaded]);

  const containerStyle = {
    height: `${height}px`,
    width: width ? `${width}px` : '100%'
  };

  if (lazyLoad && !isLoaded) {
    return (
      <div ref={ref} className={className} style={containerStyle}>
        <ChartSkeleton height={height} />
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={containerStyle}>
      <MemoizedChart
        type={type}
        data={throttledData}
        options={options}
        height={height}
        width={width}
      />
    </div>
  );
});

// Utility function to generate optimized chart colors
export const generateChartColors = (count: number, opacity: number = 1): string[] => {
  const baseColors = [
    `rgba(59, 130, 246, ${opacity})`,   // Blue
    `rgba(16, 185, 129, ${opacity})`,   // Green
    `rgba(251, 146, 60, ${opacity})`,   // Orange
    `rgba(147, 51, 234, ${opacity})`,   // Purple
    `rgba(236, 72, 153, ${opacity})`,   // Pink
    `rgba(20, 184, 166, ${opacity})`,   // Teal
    `rgba(251, 191, 36, ${opacity})`,   // Yellow
    `rgba(239, 68, 68, ${opacity})`,    // Red
  ];

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
};

// Utility function to format large numbers for charts
export const formatChartNumber = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
};

// Chart data transformer utilities
export const chartDataTransformers = {
  // Transform time series data for line charts
  transformTimeSeries: (data: Array<{ date: Date; value: number }>, label: string) => ({
    labels: data.map(d => d.date.toLocaleDateString()),
    datasets: [{
      label,
      data: data.map(d => d.value),
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4
    }]
  }),

  // Transform category data for bar charts
  transformCategories: (data: Record<string, number>, label: string) => {
    const entries = Object.entries(data);
    return {
      labels: entries.map(([key]) => key),
      datasets: [{
        label,
        data: entries.map(([, value]) => value),
        backgroundColor: generateChartColors(entries.length, 0.8),
        borderColor: generateChartColors(entries.length, 1),
        borderWidth: 1
      }]
    };
  },

  // Transform data for pie/doughnut charts
  transformPieData: (data: Record<string, number>) => {
    const entries = Object.entries(data);
    return {
      labels: entries.map(([key]) => key),
      datasets: [{
        data: entries.map(([, value]) => value),
        backgroundColor: generateChartColors(entries.length, 0.8),
        borderColor: generateChartColors(entries.length, 1),
        borderWidth: 1
      }]
    };
  }
};

export default OptimizedChart;
