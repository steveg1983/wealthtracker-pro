import React, { Suspense, lazy } from 'react';
import { Skeleton } from '../loading/Skeleton';

// Lazy load chart components
const LazyPieChart = lazy(() => import('./LazyPieChartComponent'));
const LazyBarChart = lazy(() => import('./LazyBarChartComponent'));
const LazyLineChart = lazy(() => import('./LazyLineChartComponent'));
const LazyTreemap = lazy(() => import('./LazyTreemapComponent'));

// Define minimal prop types for charts
interface PieChartProps extends Record<string, unknown> {
  width?: number;
  height?: number;
  data?: unknown[];
}

interface BarChartProps extends Record<string, unknown> {
  width?: number;
  height?: number;
  data?: unknown[];
}

interface LineChartProps extends Record<string, unknown> {
  width?: number;
  height?: number;
  data?: unknown[];
}

type TreemapDataType = {
  name?: string;
  value?: number;
  children?: readonly TreemapDataType[];
  [key: string]: unknown;
};

interface TreemapProps extends Record<string, unknown> {
  width?: number;
  height?: number;
  data?: readonly TreemapDataType[];
}

// Loading component for charts
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

function getFallbackHeight(props: unknown): number {
  if (props && typeof props === 'object' && 'height' in props) {
    const potentialHeight = (props as { height?: unknown }).height;
    if (typeof potentialHeight === 'number') {
      return potentialHeight;
    }
  }

  return 300;
}

// Wrapper components with loading states
export function PieChart(props: PieChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={getFallbackHeight(props)} />}>
      <LazyPieChart {...props} />
    </Suspense>
  );
}

export function BarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={getFallbackHeight(props)} />}>
      <LazyBarChart {...props} />
    </Suspense>
  );
}

export function LineChart(props: LineChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={getFallbackHeight(props)} />}>
      <LazyLineChart {...props} />
    </Suspense>
  );
}

export function Treemap(props: TreemapProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={getFallbackHeight(props)} />}>
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
