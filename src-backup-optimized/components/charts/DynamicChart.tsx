/**
 * DynamicChart - True runtime dynamic loading for Recharts
 * This component loads Recharts only when actually rendered
 */

import React, { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

// Chart loading skeleton with proper styling
export const ChartSkeleton: React.FC<{
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}> = ({
  height = 300,
  className = '',
  style = {}
}) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg ${className}`}
    style={{ height, ...style }}
  >
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 dark:text-gray-500">
        <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>
  </div>
);

// Types for chart configurations
export interface DynamicChartProps {
  type: 'pie' | 'bar' | 'line' | 'area' | 'treemap' | 'composed' | 'scatter' | 'radar';
  data: any[];
  config: ChartConfig;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  onChartReady?: () => void;
}

interface ChartConfig {
  // Common props
  margin?: { top?: number; right?: number; bottom?: number; left?: number };

  // For PieChart
  dataKey?: string;
  nameKey?: string;
  cx?: string | number;
  cy?: string | number;
  innerRadius?: number;
  outerRadius?: number;
  colors?: string[];

  // For Bar/Line/Area charts
  xDataKey?: string;
  yDataKeys?: string[];

  // Custom components
  customTooltip?: React.ComponentType<any>;
  customLabel?: React.ComponentType<any>;

  // Other props
  [key: string]: any;
}

// Cache for loaded Recharts modules
const moduleCache = new Map<string, Promise<any>>();

// Dynamic component loader
async function loadChartComponents(components: string[]): Promise<Record<string, any>> {
  const cacheKey = components.join(',');

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey)!;
  }

  const promise = import('recharts').then(recharts => {
    const result: Record<string, any> = {};
    components.forEach(comp => {
      if (comp in recharts) {
        result[comp] = (recharts as any)[comp];
      }
    });
    return result;
  });

  moduleCache.set(cacheKey, promise);
  return promise;
}

export const DynamicChart: React.FC<DynamicChartProps> = ({
  type,
  data,
  config,
  height = 300,
  className = '',
  style = {},
  onChartReady
}) => {
  const [chartComponents, setChartComponents] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    // Prevent double loading
    if (loadingRef.current) return;
    loadingRef.current = true;

    // Determine which components to load based on chart type
    const getRequiredComponents = () => {
      const common = ['ResponsiveContainer', 'Tooltip', 'Legend', 'Cell'];

      switch (type) {
        case 'pie':
          return [...common, 'PieChart', 'Pie'];
        case 'bar':
          return [...common, 'BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid'];
        case 'line':
          return [...common, 'LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid'];
        case 'area':
          return [...common, 'AreaChart', 'Area', 'XAxis', 'YAxis', 'CartesianGrid'];
        case 'treemap':
          return [...common, 'Treemap'];
        case 'composed':
          return [...common, 'ComposedChart', 'Bar', 'Line', 'Area', 'XAxis', 'YAxis', 'CartesianGrid'];
        case 'scatter':
          return [...common, 'ScatterChart', 'Scatter', 'XAxis', 'YAxis', 'CartesianGrid'];
        case 'radar':
          return [...common, 'RadarChart', 'Radar', 'PolarGrid', 'PolarAngleAxis', 'PolarRadiusAxis'];
        default:
          return common;
      }
    };

    // Load components
    loadChartComponents(getRequiredComponents())
      .then(components => {
        setChartComponents(components);
        onChartReady?.();
      })
      .catch(err => {
        console.error('Failed to load chart components:', err);
        setError('Failed to load chart');
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [type, onChartReady]);

  // Show error state
  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg ${className}`}
        style={{ height, ...style }}
      >
        <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  // Show loading state
  if (!chartComponents) {
    return <ChartSkeleton height={height} className={className} style={style} />;
  }

  // Render the appropriate chart
  const renderChart = () => {
    const {
      ResponsiveContainer,
      Tooltip,
      Legend,
      Cell,
      PieChart,
      Pie,
      BarChart,
      Bar,
      LineChart,
      Line,
      AreaChart,
      Area,
      Treemap,
      ComposedChart,
      ScatterChart,
      Scatter,
      RadarChart,
      Radar,
      XAxis,
      YAxis,
      CartesianGrid,
      PolarGrid,
      PolarAngleAxis,
      PolarRadiusAxis
    } = chartComponents;

    const commonProps = {
      margin: config.margin || { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart {...commonProps}>
              <Pie
                data={data}
                dataKey={config.dataKey || 'value'}
                nameKey={config.nameKey || 'name'}
                cx={config.cx || '50%'}
                cy={config.cy || '50%'}
                innerRadius={config.innerRadius}
                outerRadius={config.outerRadius || 80}
                paddingAngle={config.paddingAngle || 0}
              >
                {config.colors && data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={config.colors![index % config.colors!.length]} />
                ))}
              </Pie>
              {config.showTooltip !== false && <Tooltip content={config.customTooltip} />}
              {config.showLegend !== false && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={config.xDataKey || 'name'} />
              <YAxis />
              {config.showTooltip !== false && <Tooltip content={config.customTooltip} />}
              {config.showLegend !== false && <Legend />}
              {(config.yDataKeys || ['value']).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={config.colors?.[index] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={config.xDataKey || 'name'} />
              <YAxis />
              {config.showTooltip !== false && <Tooltip content={config.customTooltip} />}
              {config.showLegend !== false && <Legend />}
              {(config.yDataKeys || ['value']).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={config.colors?.[index] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={config.xDataKey || 'name'} />
              <YAxis />
              {config.showTooltip !== false && <Tooltip content={config.customTooltip} />}
              {config.showLegend !== false && <Legend />}
              {(config.yDataKeys || ['value']).map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId={config.stacked ? '1' : undefined}
                  stroke={config.colors?.[index] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                  fill={config.colors?.[index] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'treemap':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <Treemap
              data={data}
              dataKey={config.dataKey || 'size'}
              ratio={4 / 3}
              stroke="#fff"
              fill="#8884d8"
              {...config}
            />
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type: {type}</div>;
    }
  };

  return (
    <div className={className} style={style}>
      {renderChart()}
    </div>
  );
};

// Preload function for critical charts
export function preloadChart(type: DynamicChartProps['type']) {
  const components = {
    pie: ['ResponsiveContainer', 'PieChart', 'Pie', 'Tooltip', 'Legend', 'Cell'],
    bar: ['ResponsiveContainer', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend'],
    line: ['ResponsiveContainer', 'LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend'],
    area: ['ResponsiveContainer', 'AreaChart', 'Area', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend'],
    treemap: ['ResponsiveContainer', 'Treemap', 'Tooltip'],
    composed: ['ResponsiveContainer', 'ComposedChart', 'Bar', 'Line', 'Area', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend'],
    scatter: ['ResponsiveContainer', 'ScatterChart', 'Scatter', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend'],
    radar: ['ResponsiveContainer', 'RadarChart', 'Radar', 'PolarGrid', 'PolarAngleAxis', 'PolarRadiusAxis', 'Tooltip', 'Legend']
  };

  if (type in components) {
    loadChartComponents(components[type as keyof typeof components]);
  }
}

// Export for easy migration
export default DynamicChart;