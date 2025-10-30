import React, { Suspense, lazy, type LazyExoticComponent } from 'react';
import { Skeleton } from '../loading/Skeleton';

const loadChartComponents = () =>
  import(/* webpackChunkName: "chart-components" */ './ChartComponents');

type ChartComponentName =
  keyof typeof import('./ChartComponents');

type LazyRenderableComponent = LazyExoticComponent<(props: Record<string, unknown>) => JSX.Element>;

function lazyChartComponent<Name extends ChartComponentName>(name: Name): LazyRenderableComponent {
  return lazy(() =>
    loadChartComponents().then(module => ({
      default: function LazyChartComponent(props: Record<string, unknown>) {
        const Component = module[name] as (props: Record<string, unknown>) => JSX.Element;
        return <Component {...props} />;
      },
    }))
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

function resolveHeight<P>(props: P): number {
  const candidate = (props as { height?: unknown }).height;
  return typeof candidate === 'number' ? candidate : 300;
}

const LazyPieChartWrapper = lazy(() =>
  import(/* webpackChunkName: "chart-pie" */ './wrappers/PieChartWrapper').then(module => ({
    default: (props: Record<string, unknown>) => {
      const Component = module.default;
      return <Component {...props} />;
    },
  }))
);

const LazyBarChartWrapper = lazy(() =>
  import(/* webpackChunkName: "chart-bar" */ './wrappers/BarChartWrapper').then(module => ({
    default: (props: Record<string, unknown>) => {
      const Component = module.default;
      return <Component {...props} />;
    },
  }))
);

const LazyLineChartWrapper = lazy(() =>
  import(/* webpackChunkName: "chart-line" */ './wrappers/LineChartWrapper').then(module => ({
    default: (props: Record<string, unknown>) => {
      const Component = module.default;
      return <Component {...props} />;
    },
  }))
);

const LazyAreaChartWrapper = lazy(() =>
  import(/* webpackChunkName: "chart-area" */ './wrappers/AreaChartWrapper').then(module => ({
    default: (props: Record<string, unknown>) => {
      const Component = module.default;
      return <Component {...props} />;
    },
  }))
);

const LazyComposedChartWrapper = lazy(() =>
  import(/* webpackChunkName: "chart-composed" */ './wrappers/ComposedChartWrapper').then(module => ({
    default: (props: Record<string, unknown>) => {
      const Component = module.default;
      return <Component {...props} />;
    },
  }))
);

const LazyTreemapWrapper = lazy(() =>
  import(/* webpackChunkName: "chart-treemap" */ './wrappers/TreemapWrapper').then(module => ({
    default: (props: Record<string, unknown>) => {
      const Component = module.default;
      return <Component {...props} />;
    },
  }))
);

type LazyWrapperProps = {
  height?: number;
  [key: string]: unknown;
};

export function PieChart(props: LazyWrapperProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={resolveHeight(props)} />}>
      <LazyPieChartWrapper {...props} />
    </Suspense>
  );
}

export function BarChart(props: LazyWrapperProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={resolveHeight(props)} />}>
      <LazyBarChartWrapper {...props} />
    </Suspense>
  );
}

export function LineChart(props: LazyWrapperProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={resolveHeight(props)} />}>
      <LazyLineChartWrapper {...props} />
    </Suspense>
  );
}

export function AreaChart(props: LazyWrapperProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={resolveHeight(props)} />}>
      <LazyAreaChartWrapper {...props} />
    </Suspense>
  );
}

export function ComposedChart(props: LazyWrapperProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={resolveHeight(props)} />}>
      <LazyComposedChartWrapper {...props} />
    </Suspense>
  );
}

export function Treemap(props: LazyWrapperProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={resolveHeight(props)} />}>
      <LazyTreemapWrapper {...props} />
    </Suspense>
  );
}

export const ResponsiveContainer = lazyChartComponent('ResponsiveContainer');
export const Tooltip = lazyChartComponent('Tooltip');
export const Cell = lazyChartComponent('Cell');
export const Pie = lazyChartComponent('Pie');
export const Bar = lazyChartComponent('Bar');
export const Line = lazyChartComponent('Line');
export const Area = lazyChartComponent('Area');
export const Scatter = lazyChartComponent('Scatter');
export const XAxis = lazyChartComponent('XAxis');
export const YAxis = lazyChartComponent('YAxis');
export const CartesianGrid = lazyChartComponent('CartesianGrid');
export const Legend = lazyChartComponent('Legend');

// eslint-disable-next-line react-refresh/only-export-components
export function preloadCharts() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      void loadChartComponents();
      void import(/* webpackChunkName: "chart-pie" */ './wrappers/PieChartWrapper');
      void import(/* webpackChunkName: "chart-bar" */ './wrappers/BarChartWrapper');
    });
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export { CHART_COLORS } from '../../constants/chartColors';
