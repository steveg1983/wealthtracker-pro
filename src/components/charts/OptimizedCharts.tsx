import React, {
  Suspense,
  lazy,
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType
} from 'react';
import { Skeleton } from '../loading/Skeleton';

import type { default as PieChartWrapperComponent } from './wrappers/PieChartWrapper';
import type { default as BarChartWrapperComponent } from './wrappers/BarChartWrapper';
import type { default as LineChartWrapperComponent } from './wrappers/LineChartWrapper';
import type { default as AreaChartWrapperComponent } from './wrappers/AreaChartWrapper';
import type { default as TreemapWrapperComponent } from './wrappers/TreemapWrapper';

type ChartModule = typeof import('./ChartComponents');
type ChartComponentKey =
  | 'ResponsiveContainer'
  | 'Tooltip'
  | 'Cell'
  | 'Pie'
  | 'Bar'
  | 'Line'
  | 'Area'
  | 'XAxis'
  | 'YAxis'
  | 'CartesianGrid'
  | 'Legend'
  | 'PolarGrid'
  | 'PolarAngleAxis'
  | 'PolarRadiusAxis'
  | 'Radar'
  | 'RadialBar'
  | 'Scatter'
  | 'ZAxis'
  | 'ErrorBar'
  | 'ReferenceLine'
  | 'ReferenceArea'
  | 'ReferenceDot'
  | 'Brush'
  | 'LabelList';

type ChartComponentProps<K extends ChartComponentKey> = ChartModule[K] extends ComponentType<infer P> ? P : never;
type ChartComponentType<K extends ChartComponentKey> = ComponentType<ChartComponentProps<K>>;

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

// Shared skeleton used while chart modules stream in
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLazyChart<P extends Record<string, any>>(LazyComponent: React.LazyExoticComponent<ComponentType<P>>) {
  return function LazyLoadedChart(props: P) {
    // Cast to any to work around complex generic type inference issues with lazy components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LazyComp = LazyComponent as React.ComponentType<any>;
    return (
      <Suspense fallback={<ChartSkeleton height={getFallbackHeight(props)} />}>
        <LazyComp {...props} />
      </Suspense>
    );
  };
}

function useChartComponent<K extends ChartComponentKey>(key: K) {
  const [Component, setComponent] = useState<ChartComponentType<K> | null>(null);

  useEffect(() => {
    let isMounted = true;

    import(/* webpackChunkName: "chart-components" */ './ChartComponents').then(module => {
      if (isMounted) {
        const resolved = module[key] as ChartComponentType<K>;
        setComponent(() => resolved);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [key]);

  return Component;
}

function createLazyChild<K extends ChartComponentKey>(key: K) {
  return function LazyLoadedChild(props: ChartComponentProps<K>) {
    const Component = useChartComponent(key);

    if (!Component) {
      return null;
    }

    // Cast to any component type to handle generic constraints
    const AnyComponent = Component as React.ComponentType<Record<string, unknown>>;
    return <AnyComponent {...(props as Record<string, unknown>)} />;
  };
}

type PieChartProps = ComponentProps<typeof PieChartWrapperComponent>;
type BarChartProps = ComponentProps<typeof BarChartWrapperComponent>;
type LineChartProps = ComponentProps<typeof LineChartWrapperComponent>;
type AreaChartProps = ComponentProps<typeof AreaChartWrapperComponent>;
type TreemapProps = ComponentProps<typeof TreemapWrapperComponent>;

export const PieChart = createLazyChart<PieChartProps>(LazyPieChartWrapper);
export const BarChart = createLazyChart<BarChartProps>(LazyBarChartWrapper);
export const LineChart = createLazyChart<LineChartProps>(LazyLineChartWrapper);
export const AreaChart = createLazyChart<AreaChartProps>(LazyAreaChartWrapper);
export const Treemap = createLazyChart<TreemapProps>(LazyTreemapWrapper);

type ResponsiveContainerProps = ChartComponentProps<'ResponsiveContainer'>;

export function ResponsiveContainer(props: ResponsiveContainerProps) {
  const Component = useChartComponent('ResponsiveContainer');

  if (!Component) {
    const { width, height, children } = props;

    return (
      <div
        style={{
          width:
            typeof width === 'number' || typeof width === 'string' ? width : '100%',
          height:
            typeof height === 'number' || typeof height === 'string' ? height : 300
        }}
      >
        {children}
      </div>
    );
  }

  return <Component {...props} />;
}

export const Tooltip = createLazyChild('Tooltip');
export const Cell = createLazyChild('Cell');
export const Pie = createLazyChild('Pie');
export const Bar = createLazyChild('Bar');
export const Line = createLazyChild('Line');
export const Area = createLazyChild('Area');
export const XAxis = createLazyChild('XAxis');
export const YAxis = createLazyChild('YAxis');
export const CartesianGrid = createLazyChild('CartesianGrid');
export const Legend = createLazyChild('Legend');
export const PolarGrid = createLazyChild('PolarGrid');
export const PolarAngleAxis = createLazyChild('PolarAngleAxis');
export const PolarRadiusAxis = createLazyChild('PolarRadiusAxis');
export const Radar = createLazyChild('Radar');
export const RadialBar = createLazyChild('RadialBar');
export const Scatter = createLazyChild('Scatter');
export const ZAxis = createLazyChild('ZAxis');
export const ErrorBar = createLazyChild('ErrorBar');
export const ReferenceLine = createLazyChild('ReferenceLine');
export const ReferenceArea = createLazyChild('ReferenceArea');
export const ReferenceDot = createLazyChild('ReferenceDot');
export const Brush = createLazyChild('Brush');
export const LabelList = createLazyChild('LabelList');

// Utility to preload charts for better performance
// eslint-disable-next-line react-refresh/only-export-components
export function preloadCharts() {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      import(/* webpackChunkName: "chart-components" */ './ChartComponents');
      import(/* webpackChunkName: "chart-pie" */ './wrappers/PieChartWrapper');
      import(/* webpackChunkName: "chart-bar" */ './wrappers/BarChartWrapper');
    });
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export { CHART_COLORS } from './chartColors';
