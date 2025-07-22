import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';

// Lazy load recharts components
const LazyLineChart = lazy(() => 
  import('recharts').then(module => ({ default: module.LineChart }))
);
const LazyBarChart = lazy(() => 
  import('recharts').then(module => ({ default: module.BarChart }))
);
const LazyPieChart = lazy(() => 
  import('recharts').then(module => ({ default: module.PieChart }))
);
const LazyAreaChart = lazy(() => 
  import('recharts').then(module => ({ default: module.AreaChart }))
);

// Loading placeholder for charts
function ChartLoader(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded w-full h-full"></div>
    </div>
  );
}

// Export wrapped chart components
export function LineChart(props: ComponentProps<typeof LazyLineChart>): React.JSX.Element {
  return (
    <Suspense fallback={<ChartLoader />}>
      <LazyLineChart {...props} />
    </Suspense>
  );
}

export function BarChart(props: ComponentProps<typeof LazyBarChart>): React.JSX.Element {
  return (
    <Suspense fallback={<ChartLoader />}>
      <LazyBarChart {...props} />
    </Suspense>
  );
}

export function PieChart(props: ComponentProps<typeof LazyPieChart>): React.JSX.Element {
  return (
    <Suspense fallback={<ChartLoader />}>
      <LazyPieChart {...props} />
    </Suspense>
  );
}

export function AreaChart(props: ComponentProps<typeof LazyAreaChart>): React.JSX.Element {
  return (
    <Suspense fallback={<ChartLoader />}>
      <LazyAreaChart {...props} />
    </Suspense>
  );
}

// Re-export other recharts components that we need
export { 
  Line, Bar, Pie, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell, Sector 
} from 'recharts';