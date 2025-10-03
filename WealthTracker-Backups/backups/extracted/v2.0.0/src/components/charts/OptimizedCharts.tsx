import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Skeleton } from '../loading/Skeleton';

// Chart loading state component
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

// Lazy load individual chart wrapper components
const LazyPieChartWrapper = lazy(() => 
  import(/* webpackChunkName: "chart-pie" */ './wrappers/PieChartWrapper')
);

const LazyBarChartWrapper = lazy(() => 
  import(/* webpackChunkName: "chart-bar" */ './wrappers/BarChartWrapper')
);

const LazyLineChartWrapper = lazy(() => 
  import(/* webpackChunkName: "chart-line" */ './wrappers/LineChartWrapper')
);

const LazyAreaChartWrapper = lazy(() => 
  import(/* webpackChunkName: "chart-area" */ './wrappers/AreaChartWrapper')
);

const LazyTreemapWrapper = lazy(() => 
  import(/* webpackChunkName: "chart-treemap" */ './wrappers/TreemapWrapper')
);

// Export chart components with proper lazy loading
export function PieChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyPieChartWrapper {...props} />
    </Suspense>
  );
}

export function BarChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyBarChartWrapper {...props} />
    </Suspense>
  );
}

export function LineChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyLineChartWrapper {...props} />
    </Suspense>
  );
}

export function AreaChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyAreaChartWrapper {...props} />
    </Suspense>
  );
}

export function Treemap(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height || 300} />}>
      <LazyTreemapWrapper {...props} />
    </Suspense>
  );
}

// Lazy load chart child components
const LazyChartComponents = lazy(() => 
  import(/* webpackChunkName: "chart-components" */ './ChartComponents')
);

// Create a hook to use chart components
function useChartComponents() {
  const [components, setComponents] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponents(module));
  }, []);
  
  return components;
}

// Export individual component wrappers
export function ResponsiveContainer({ children, ...props }: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.ResponsiveContainer));
  }, []);
  
  if (!Component) return <div style={{ width: props.width, height: props.height }}>{children}</div>;
  return <Component {...props}>{children}</Component>;
}

export function Tooltip(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Tooltip));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function Cell(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Cell));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function Pie(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Pie));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function Bar(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Bar));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function Line(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Line));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function Area(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Area));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function XAxis(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.XAxis));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function YAxis(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.YAxis));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function CartesianGrid(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.CartesianGrid));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

export function Legend(props: any) {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    import(/* webpackChunkName: "chart-components" */ './ChartComponents')
      .then(module => setComponent(() => module.Legend));
  }, []);
  
  if (!Component) return null;
  return <Component {...props} />;
}

// Utility to preload charts for better performance
export function preloadCharts() {
  // Trigger loading of chart modules in the background when browser is idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import(/* webpackChunkName: "chart-components" */ './ChartComponents');
      import(/* webpackChunkName: "chart-pie" */ './wrappers/PieChartWrapper');
      import(/* webpackChunkName: "chart-bar" */ './wrappers/BarChartWrapper');
    });
  }
}

// Export chart colors for consistency
export const CHART_COLORS = [
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
];