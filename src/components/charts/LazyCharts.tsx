import React, { Suspense, lazy } from 'react';
import { Skeleton } from '../loading/Skeleton';

// Lazy load chart components
const LazyPieChart = lazy(() => import('./LazyPieChartComponent'));
const LazyBarChart = lazy(() => import('./LazyBarChartComponent'));
const LazyLineChart = lazy(() => import('./LazyLineChartComponent'));
const LazyTreemap = lazy(() => import('./LazyTreemapComponent'));

// Loading component for charts
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

// Wrapper components with loading states
export function PieChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyPieChart {...props} />
    </Suspense>
  );
}

export function BarChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyBarChart {...props} />
    </Suspense>
  );
}

export function LineChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyLineChart {...props} />
    </Suspense>
  );
}

export function Treemap(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyTreemap {...props} />
    </Suspense>
  );
}

// Re-export common chart components that don't need lazy loading
export { 
  ResponsiveContainer, 
  Tooltip, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Legend,
  Pie,
  Bar,
  Line
} from 'recharts';