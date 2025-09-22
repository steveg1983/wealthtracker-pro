/**
 * ChartMigration - Helper components to migrate from static to dynamic charts
 * These wrappers make it easy to replace existing Recharts imports
 */

import React, { Suspense } from 'react';
import { DynamicChart, ChartSkeleton, type DynamicChartProps } from './DynamicChart';

// Wrapper for existing PieChart usage
export const DynamicPieChart: React.FC<{
  data: any[];
  dataKey?: string;
  nameKey?: string;
  colors?: string[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
  customTooltip?: React.ComponentType<any>;
}> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height} className={props.className} />}>
      <DynamicChart
        type="pie"
        data={props.data}
        config={{
          dataKey: props.dataKey,
          nameKey: props.nameKey,
          colors: props.colors,
          innerRadius: props.innerRadius,
          outerRadius: props.outerRadius,
          customTooltip: props.customTooltip
        }}
        height={props.height}
        className={props.className}
      />
    </Suspense>
  );
};

// Wrapper for existing BarChart usage
export const DynamicBarChart: React.FC<{
  data: any[];
  xDataKey?: string;
  yDataKeys?: string[];
  colors?: string[];
  height?: number;
  className?: string;
  customTooltip?: React.ComponentType<any>;
}> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height} className={props.className} />}>
      <DynamicChart
        type="bar"
        data={props.data}
        config={{
          xDataKey: props.xDataKey,
          yDataKeys: props.yDataKeys,
          colors: props.colors,
          customTooltip: props.customTooltip
        }}
        height={props.height}
        className={props.className}
      />
    </Suspense>
  );
};

// Wrapper for existing LineChart usage
export const DynamicLineChart: React.FC<{
  data: any[];
  xDataKey?: string;
  yDataKeys?: string[];
  colors?: string[];
  height?: number;
  className?: string;
  customTooltip?: React.ComponentType<any>;
}> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height} className={props.className} />}>
      <DynamicChart
        type="line"
        data={props.data}
        config={{
          xDataKey: props.xDataKey,
          yDataKeys: props.yDataKeys,
          colors: props.colors,
          customTooltip: props.customTooltip
        }}
        height={props.height}
        className={props.className}
      />
    </Suspense>
  );
};

// Wrapper for existing AreaChart usage
export const DynamicAreaChart: React.FC<{
  data: any[];
  xDataKey?: string;
  yDataKeys?: string[];
  colors?: string[];
  stacked?: boolean;
  height?: number;
  className?: string;
  customTooltip?: React.ComponentType<any>;
}> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height} className={props.className} />}>
      <DynamicChart
        type="area"
        data={props.data}
        config={{
          xDataKey: props.xDataKey,
          yDataKeys: props.yDataKeys,
          colors: props.colors,
          stacked: props.stacked,
          customTooltip: props.customTooltip
        }}
        height={props.height}
        className={props.className}
      />
    </Suspense>
  );
};

// Wrapper for existing Treemap usage
export const DynamicTreemap: React.FC<{
  data: any[];
  dataKey?: string;
  height?: number;
  className?: string;
  [key: string]: any;
}> = ({ data, dataKey, height, className, ...rest }) => {
  return (
    <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
      <DynamicChart
        type="treemap"
        data={data}
        config={{
          dataKey,
          ...rest
        }}
        height={height}
        className={className}
      />
    </Suspense>
  );
};

// Export all dynamic chart components
export {
  DynamicChart,
  ChartSkeleton,
  preloadChart
} from './DynamicChart';

// Re-export with Recharts-compatible names for easier migration
export const PieChart = DynamicPieChart;
export const BarChart = DynamicBarChart;
export const LineChart = DynamicLineChart;
export const AreaChart = DynamicAreaChart;
export const Treemap = DynamicTreemap;

// Helper to convert existing Recharts components to dynamic
export const ResponsiveContainer: React.FC<{ width?: string | number; height?: string | number; children: React.ReactNode }> = ({ children }) => {
  // DynamicChart already includes ResponsiveContainer
  return <>{children}</>;
};

// Placeholder components that are handled internally by DynamicChart
export const Tooltip = () => null;
export const Legend = () => null;
export const Cell = () => null;
export const Pie = () => null;
export const Bar = () => null;
export const Line = () => null;
export const Area = () => null;
export const XAxis = () => null;
export const YAxis = () => null;
export const CartesianGrid = () => null;