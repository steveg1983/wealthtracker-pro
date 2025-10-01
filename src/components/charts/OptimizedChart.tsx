import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  PieChart,
  Line,
  Bar,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell
} from './OptimizedCharts';
import { CHART_COLORS } from './OptimizedCharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export type OptimizedChartType = 'line' | 'bar' | 'pie' | 'doughnut';

interface BaseChartOptions {
  title?: string;
  legendPosition?: 'top' | 'bottom';
  showLegend?: boolean;
  showGrid?: boolean;
}

export interface LineBarDataset {
  key: string;
  name: string;
  color?: string;
  strokeWidth?: number;
  stackId?: string;
  type?: 'linear' | 'monotone' | 'basis' | 'step';
  hideInLegend?: boolean;
}

export type LineBarDatum = Record<string, string | number | null | undefined> & {
  [key: string]: string | number | null | undefined;
};

export interface LineBarChartData {
  xKey: string;
  data: LineBarDatum[];
  datasets: LineBarDataset[];
}

export interface LineBarChartOptions extends BaseChartOptions {
  yAxisFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string | number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  showDots?: boolean;
  stacked?: boolean;
}

export interface PieChartDatum {
  name: string;
  value: number;
  color?: string;
}

export interface PieChartOptions extends BaseChartOptions {
  tooltipFormatter?: (value: number, name: string) => string;
  innerRadius?: number;
  outerRadius?: number;
}

interface SharedChartProps {
  height?: number;
  width?: number;
  className?: string;
  lazyLoad?: boolean;
  throttleRedraw?: number;
}

interface LineBarChartProps extends SharedChartProps {
  type: 'line' | 'bar';
  data: LineBarChartData;
  options?: LineBarChartOptions;
}

interface PieOnlyChartProps extends SharedChartProps {
  type: 'pie' | 'doughnut';
  data: PieChartDatum[];
  options?: PieChartOptions;
}

export type OptimizedChartProps = LineBarChartProps | PieOnlyChartProps;

type ChartRenderProps =
  | { type: 'line' | 'bar'; data: LineBarChartData; options?: LineBarChartOptions }
  | { type: 'pie' | 'doughnut'; data: PieChartDatum[]; options?: PieChartOptions };

interface UseInViewOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

const tooltipStyles = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: '0.5rem',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  padding: '0.5rem 0.75rem',
  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)'
} as const;

const defaultNumberFormatter = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

function useInView({ threshold = 0, rootMargin, triggerOnce = false }: UseInViewOptions) {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: Element | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observerOptions: IntersectionObserverInit = { threshold };
    if (rootMargin !== undefined) {
      observerOptions.rootMargin = rootMargin;
    }

    observerRef.current = new window.IntersectionObserver(entries => {
      const [entry] = entries;
      if (!entry) {
        return;
      }

      if (entry.isIntersecting) {
        setInView(true);
        if (triggerOnce) {
          observerRef.current?.disconnect();
          observerRef.current = null;
        }
      } else if (!triggerOnce) {
        setInView(false);
      }
    }, observerOptions);

    observerRef.current.observe(node);
  }, [threshold, rootMargin, triggerOnce]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, inView } as const;
}

const ChartSkeleton = memo(({ height = 200 }: { height?: number }) => (
  <div
    className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg"
    style={{ height: `${height}px` }}
  >
    <div className="h-full flex items-center justify-center">
      <div className="space-y-2">
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32" />
        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-24" />
      </div>
    </div>
  </div>
));

const MemoizedChart = memo((props: ChartRenderProps) => {
  const { type, data, options } = props;

  if (type === 'line' || type === 'bar') {
    const chartData = data;
    const chartOptions = options ?? {};
    const showLegend = chartOptions.showLegend ?? true;
    const legendVerticalAlign = chartOptions.legendPosition === 'bottom' ? 'bottom' : 'top';
    const xFormatter = chartOptions.xAxisFormatter
      ? (value: string | number) => chartOptions.xAxisFormatter?.(value)
      : undefined;
    const yFormatter = chartOptions.yAxisFormatter
      ? (value: number) => chartOptions.yAxisFormatter?.(value)
      : undefined;

    const renderTooltipContent = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
      if (!active || !payload?.length) {
        return null;
      }

      const labelString = typeof label === 'number' || typeof label === 'string'
        ? (xFormatter ? xFormatter(label) : String(label))
        : '';

      return (
        <div style={tooltipStyles} className="bg-white dark:bg-gray-900 dark:text-gray-100">
          {labelString && (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {labelString}
            </p>
          )}
          <div className="space-y-1">
            {payload.map(entry => {
              const rawValue = entry.value ?? 0;
              const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
              const formatted = chartOptions.tooltipFormatter
                ? chartOptions.tooltipFormatter(numericValue, entry.name ?? '')
                : defaultNumberFormatter(numericValue);

              return (
                <div key={entry.dataKey?.toString() ?? entry.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color || '#6366F1' }}
                  />
                  <span className="text-gray-700 dark:text-gray-200">{entry.name}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatted}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const ChartComponent = type === 'line' ? LineChart : BarChart;

    return (
      <div className="flex h-full w-full flex-col">
        {chartOptions.title && (
          <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            {chartOptions.title}
          </div>
        )}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent
              data={chartData.data}
              margin={{
                top: showLegend && chartOptions.legendPosition !== 'bottom' ? 24 : 8,
                right: 16,
                left: 8,
                bottom: showLegend && chartOptions.legendPosition === 'bottom' ? 32 : 8
              }}
            >
              {(chartOptions.showGrid ?? true) && (
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
              )}
              <XAxis
                dataKey={chartData.xKey}
                axisLine={false}
                tickLine={false}
                tickFormatter={xFormatter}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={yFormatter}
              />
              <RechartsTooltip content={renderTooltipContent} cursor={{ strokeDasharray: '3 3' }} />
              {showLegend && (
                <Legend
                  verticalAlign={legendVerticalAlign}
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ paddingTop: chartOptions.legendPosition === 'bottom' ? 12 : 0 }}
                />
              )}
              {chartData.datasets.map((dataset, index) => {
                const baseColor = dataset.color ?? CHART_COLORS[index % CHART_COLORS.length];
                if (type === 'line') {
                  return (
                    <Line
                      key={dataset.key}
                      type={dataset.type ?? 'monotone'}
                      dataKey={dataset.key}
                      name={dataset.name}
                      stroke={baseColor}
                      strokeWidth={dataset.strokeWidth ?? 2}
                      dot={chartOptions.showDots ?? false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                      connectNulls
                    />
                  );
                }

                return (
                  <Bar
                    key={dataset.key}
                    dataKey={dataset.key}
                    name={dataset.name}
                    stackId={chartOptions.stacked ? dataset.stackId ?? 'stack' : dataset.stackId}
                    fill={baseColor}
                    isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                  />
                );
              })}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const chartData = data;
  const chartOptions = options ?? {};
  const showLegend = chartOptions.showLegend ?? true;
  const legendVerticalAlign = chartOptions.legendPosition === 'bottom' ? 'bottom' : 'top';
  const innerRadius = type === 'doughnut'
    ? chartOptions.innerRadius ?? 45
    : chartOptions.innerRadius ?? 0;
  const outerRadius = chartOptions.outerRadius ?? 80;

  const renderPieTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) {
      return null;
    }

    const firstDatum = payload[0];
    const rawValue = firstDatum.value ?? 0;
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    const formatted = chartOptions.tooltipFormatter
      ? chartOptions.tooltipFormatter(numericValue, firstDatum.name ?? '')
      : defaultNumberFormatter(numericValue);

    return (
      <div style={tooltipStyles} className="bg-white dark:bg-gray-900 dark:text-gray-100">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {firstDatum.name}
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatted}</p>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col">
      {chartOptions.title && (
        <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {chartOptions.title}
        </div>
      )}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RechartsTooltip content={renderPieTooltip} />
            {showLegend && (
              <Legend verticalAlign={legendVerticalAlign} align="center" iconType="circle" />
            )}
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              cornerRadius={4}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

MemoizedChart.displayName = 'MemoizedChart';

export const OptimizedChart: React.FC<OptimizedChartProps> = memo((props) => {
  const {
    type,
    data,
    options,
    height = 200,
    width,
    className = '',
    lazyLoad = true,
    throttleRedraw = 100
  } = props;

  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
    rootMargin: '50px'
  });

  const [isLoaded, setIsLoaded] = useState(!lazyLoad);
  const [throttledData, setThrottledData] = useState<OptimizedChartProps['data']>(data);
  const lastUpdateTime = useRef(Date.now());

  useEffect(() => {
    if (throttleRedraw > 0) {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;

      if (timeSinceLastUpdate >= throttleRedraw) {
        setThrottledData(data);
        lastUpdateTime.current = now;
      } else {
        const timeout = window.setTimeout(() => {
          setThrottledData(data);
          lastUpdateTime.current = Date.now();
        }, throttleRedraw - timeSinceLastUpdate);

        return () => window.clearTimeout(timeout);
      }
    } else {
      setThrottledData(data);
    }
  }, [data, throttleRedraw]);

  useEffect(() => {
    if (lazyLoad && inView && !isLoaded) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => setIsLoaded(true));
      } else {
        setTimeout(() => setIsLoaded(true), 0);
      }
    }
  }, [inView, lazyLoad, isLoaded]);

  const containerStyle = {
    height: `${height}px`,
    width: width ? `${width}px` : '100%'
  } as const;

  const chartProps: ChartRenderProps = useMemo(() => {
    if (type === 'line' || type === 'bar') {
      return {
        type,
        data: throttledData as LineBarChartData,
        options: options as LineBarChartOptions | undefined
      };
    }

    return {
      type,
      data: throttledData as PieChartDatum[],
      options: options as PieChartOptions | undefined
    };
  }, [type, throttledData, options]);

  if (lazyLoad && !isLoaded) {
    return (
      <div ref={ref} className={className} style={containerStyle}>
        <ChartSkeleton height={height} />
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={containerStyle}>
      <MemoizedChart {...chartProps} />
    </div>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;
