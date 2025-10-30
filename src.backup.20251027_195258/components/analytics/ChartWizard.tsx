import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { ProfessionalIcon, type ProfessionalIconName } from '../icons/ProfessionalIcons';

// Lazy load Plotly using the lightweight dist build
const Plot = lazy(async () => {
  const [{ default: createPlotlyComponent }, Plotly] = await Promise.all([
    import('react-plotly.js/factory'),
    import('../../lib/plotlyLight')
  ]);

  return {
    default: createPlotlyComponent(Plotly.default ?? Plotly)
  };
});

export type ChartType = 
  | 'line' | 'multi-line' | 'area' | 'stacked-area'
  | 'bar' | 'grouped-bar' | 'stacked-bar' | 'horizontal-bar'
  | 'pie' | 'donut' | 'sunburst'
  | 'scatter' | 'bubble' | 'heatmap'
  | 'waterfall' | 'funnel' | 'treemap'
  | 'candlestick' | 'box' | 'violin'
  | 'sankey' | 'radar' | 'gauge';

interface ChartConfig {
  type: ChartType;
  name: string;
  description: string;
  iconName: ProfessionalIconName;
  requiredDataShape: 'single-series' | 'multi-series' | 'hierarchical' | 'time-series' | 'correlation';
  defaultOptions: Record<string, unknown>;
}

const CHART_CATALOG: ChartConfig[] = [
  // Line Charts
  {
    type: 'line',
    name: 'Line Chart',
    description: 'Track trends over time',
    iconName: 'chartLine',
    requiredDataShape: 'single-series',
    defaultOptions: {
      showLegend: true,
      showGrid: true,
      smoothing: 0.3
    }
  },
  {
    type: 'multi-line',
    name: 'Multi-Line Chart',
    description: 'Compare multiple trends',
    iconName: 'activity',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      showLegend: true,
      showGrid: true,
      interpolation: 'linear'
    }
  },
  {
    type: 'area',
    name: 'Area Chart',
    description: 'Show cumulative trends',
    iconName: 'chartArea',
    requiredDataShape: 'single-series',
    defaultOptions: {
      fillOpacity: 0.3,
      showDataPoints: false
    }
  },
  {
    type: 'stacked-area',
    name: 'Stacked Area',
    description: 'Show composition over time',
    iconName: 'layers',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      stackMode: 'normal',
      fillOpacity: 0.7
    }
  },
  
  // Bar Charts
  {
    type: 'bar',
    name: 'Bar Chart',
    description: 'Compare categories',
    iconName: 'chartBar',
    requiredDataShape: 'single-series',
    defaultOptions: {
      orientation: 'vertical',
      showValues: true
    }
  },
  {
    type: 'grouped-bar',
    name: 'Grouped Bar',
    description: 'Compare groups across categories',
    iconName: 'chartBar',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      barMode: 'group',
      barGap: 0.15
    }
  },
  {
    type: 'stacked-bar',
    name: 'Stacked Bar',
    description: 'Show composition by category',
    iconName: 'chartBar',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      barMode: 'stack',
      showTotals: true
    }
  },
  
  // Pie Charts
  {
    type: 'pie',
    name: 'Pie Chart',
    description: 'Show proportions',
    iconName: 'chartPie',
    requiredDataShape: 'single-series',
    defaultOptions: {
      showPercentages: true,
      showLegend: true
    }
  },
  {
    type: 'donut',
    name: 'Donut Chart',
    description: 'Pie with center metric',
    iconName: 'chartDonut',
    requiredDataShape: 'single-series',
    defaultOptions: {
      holeSize: 0.4,
      showCenterMetric: true
    }
  },
  {
    type: 'sunburst',
    name: 'Sunburst',
    description: 'Hierarchical pie chart',
    iconName: 'analyticsReport',
    requiredDataShape: 'hierarchical',
    defaultOptions: {
      maxDepth: 3,
      showPath: true
    }
  },
  
  // Scatter & Distribution
  {
    type: 'scatter',
    name: 'Scatter Plot',
    description: 'Show correlations',
    iconName: 'grid',
    requiredDataShape: 'correlation',
    defaultOptions: {
      showTrendline: true,
      markerSize: 8
    }
  },
  {
    type: 'bubble',
    name: 'Bubble Chart',
    description: '3D scatter with size dimension',
    iconName: 'grid',
    requiredDataShape: 'correlation',
    defaultOptions: {
      sizeRef: 2,
      showScale: true
    }
  },
  {
    type: 'heatmap',
    name: 'Heatmap',
    description: 'Density visualization',
    iconName: 'grid',
    requiredDataShape: 'correlation',
    defaultOptions: {
      colorScale: 'Viridis',
      showScale: true
    }
  },
  
  // Financial Charts
  {
    type: 'waterfall',
    name: 'Waterfall',
    description: 'Show incremental changes',
    iconName: 'trendingUp',
    requiredDataShape: 'single-series',
    defaultOptions: {
      showConnectors: true,
      showTotals: true
    }
  },
  {
    type: 'candlestick',
    name: 'Candlestick',
    description: 'OHLC financial data',
    iconName: 'chartBar',
    requiredDataShape: 'time-series',
    defaultOptions: {
      increasingColor: '#059669',
      decreasingColor: '#dc2626'
    }
  },
  
  // Statistical Charts
  {
    type: 'box',
    name: 'Box Plot',
    description: 'Statistical distribution',
    iconName: 'analyticsReport',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      showOutliers: true,
      boxMean: 'sd'
    }
  },
  {
    type: 'violin',
    name: 'Violin Plot',
    description: 'Distribution density',
    iconName: 'analyticsReport',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      showBox: true,
      meanline: true
    }
  },
  
  // Advanced Visualizations
  {
    type: 'treemap',
    name: 'Treemap',
    description: 'Hierarchical rectangles',
    iconName: 'grid',
    requiredDataShape: 'hierarchical',
    defaultOptions: {
      tiling: 'squarify',
      showPath: true
    }
  },
  {
    type: 'sankey',
    name: 'Sankey Diagram',
    description: 'Flow visualization',
    iconName: 'arrowsLeftRight',
    requiredDataShape: 'hierarchical',
    defaultOptions: {
      nodeThickness: 15,
      nodePadding: 10
    }
  },
  {
    type: 'funnel',
    name: 'Funnel Chart',
    description: 'Conversion tracking',
    iconName: 'filter',
    requiredDataShape: 'single-series',
    defaultOptions: {
      showPercentages: true,
      textPosition: 'inside'
    }
  },
  {
    type: 'radar',
    name: 'Radar Chart',
    description: 'Multi-dimensional comparison',
    iconName: 'analytics',
    requiredDataShape: 'multi-series',
    defaultOptions: {
      fillOpacity: 0.25,
      showAngularAxis: true
    }
  },
  {
    type: 'gauge',
    name: 'Gauge Chart',
    description: 'KPI indicator',
    iconName: 'trendingUp',
    requiredDataShape: 'single-series',
    defaultOptions: {
      min: 0,
      max: 100,
      showThresholds: true
    }
  }
];

type Numeric = number | null;
type ValueArray = Array<number | string | Date>;

interface ChartDataShape extends Record<string, unknown> {
  labels?: ValueArray;
  categories?: ValueArray;
  names?: ValueArray;
  x?: ValueArray;
  y?: ValueArray;
  z?: number[][];
  values?: number[];
  amounts?: number[];
  name?: string;
  label?: string;
  parents?: string[];
  tags?: string[];
  sizes?: number[] | number;
  colors?: string[] | string;
  r?: number[];
  theta?: ValueArray;
  value?: Numeric;
  max?: Numeric;
  steps?: Array<Record<string, unknown>>;
  nodeLabels?: string[];
  nodeColors?: string[] | string;
  nodes?: string[];
  linkSource?: number[];
  sources?: number[];
  linkTarget?: number[];
  targets?: number[];
  linkValue?: number[];
  distribution?: number[];
  open?: number[];
  high?: number[];
  low?: number[];
  close?: number[];
  dates?: ValueArray;
  stages?: string[];
  changes?: number[];
  xValues?: ValueArray;
  yValues?: ValueArray;
  matrix?: number[][];
  xLabels?: ValueArray;
  yLabels?: ValueArray;
  rawRows?: ChartDataShape[];
  series?: Array<{ key: string; name: string; values: number[] }>;
}

type ChartDataSource = ChartDataShape | ChartDataShape[];

export interface ChartPayload {
  type: ChartType;
  title: string;
  data: PlotTrace[];
  layout: PlotLayout;
  options: Record<string, unknown>;
}

type PlotTrace = Record<string, unknown>;
type PlotLayout = Record<string, unknown>;

const isDateLike = (value: unknown): boolean => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime());
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime());
  }

  return false;
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : new Date();
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = new Date(String(value));
    return Number.isFinite(candidate.getTime()) ? candidate : new Date();
  }

  return new Date();
};

const isNumericValue = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed);
  }
  return false;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatStringValue = (value: unknown, index: number, key: string): string => {
  if (value === undefined || value === null) {
    return `${key} ${index + 1}`;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : `${key} ${index + 1}`;
};

const buildDataFromRows = (rows: ChartDataShape[]): ChartDataShape => {
  if (rows.length === 0) {
    return { rawRows: rows };
  }

  const sample = rows[0] ?? {};
  const keys = Object.keys(sample as Record<string, unknown>);
  const numericKeys = keys.filter(key => isNumericValue((sample as Record<string, unknown>)[key]));
  const dateKeys = keys.filter(key => isDateLike((sample as Record<string, unknown>)[key]));
  const stringKeys = keys.filter(key => typeof (sample as Record<string, unknown>)[key] === 'string');

  const firstNumericKey = numericKeys[0];
  const secondNumericKey = numericKeys[1];
  const thirdNumericKey = numericKeys[2];
  const firstStringKey = stringKeys[0];
  const firstDateKey = dateKeys[0];

  const stringMetadata = stringKeys.map(key => {
    const stringValues = rows.map((row, index) => formatStringValue(row[key], index, key));
    return {
      key,
      stringValues,
      uniqueCount: new Set(stringValues).size
    };
  }).sort((a, b) => a.uniqueCount - b.uniqueCount);

  const toNumberArray = (key: string): number[] =>
    rows.map(row => toNumber(row[key]));

  const normalized: ChartDataShape = { rawRows: rows };

  if (firstDateKey) {
    const dates = rows.map(row => toDate(row[firstDateKey]));
    const formatted = dates.map(date => date.toISOString());
    normalized.x = dates;
    normalized.labels = formatted;
    normalized.categories = formatted;
  }

  const mostSpecificStringMeta = stringMetadata[stringMetadata.length - 1];
  if (mostSpecificStringMeta) {
    const strings = mostSpecificStringMeta.stringValues;
    normalized.labels ??= [...strings];
    normalized.categories ??= [...strings];
    normalized.names ??= [...strings];
    normalized.x ??= normalized.x ?? [...strings];
  } else if (firstStringKey) {
    const strings = rows.map((row, index) => formatStringValue(row[firstStringKey], index, firstStringKey));
    normalized.labels ??= strings;
    normalized.categories ??= strings;
    normalized.names ??= [...strings];
    normalized.x ??= normalized.x ?? strings;
  }

  if (firstNumericKey) {
    const numbers = toNumberArray(firstNumericKey);
    normalized.values = numbers;
    normalized.amounts = numbers;
    normalized.x ??= numbers;
  }

  if (secondNumericKey) {
    normalized.y = toNumberArray(secondNumericKey);
  }

  if (thirdNumericKey) {
    const sizeValues = toNumberArray(thirdNumericKey);
    if (sizeValues.some(value => Number.isFinite(value))) {
      normalized.sizes = sizeValues;
    }
  }

  if (!normalized.labels) {
    const defaultLabels = rows.map((_, index) => `Row ${index + 1}`);
    normalized.labels = defaultLabels;
    normalized.categories = normalized.categories ?? [...defaultLabels];
    normalized.names = normalized.names ?? [...defaultLabels];
    normalized.x ??= [...defaultLabels];
  }

  if (numericKeys.length > 0) {
    normalized.series = numericKeys.map(key => ({
      key,
      name: key,
      values: toNumberArray(key)
    }));
    if (!normalized.values && normalized.series.length > 0) {
      normalized.values = normalized.series[0]?.values ?? [];
    }
  }

  if (stringMetadata.length >= 2) {
    const childMeta = stringMetadata[stringMetadata.length - 1];
    if (childMeta) {
      const ancestorMetas = stringMetadata.slice(0, -1);
      const childValues = childMeta.stringValues;

      normalized.names ??= [...childValues];
      normalized.labels ??= [...childValues];
      normalized.categories ??= [...childValues];

      normalized.parents = childValues.map((child, index): string => {
        const ancestor = [...ancestorMetas].reverse().find(meta => meta.stringValues[index] !== child);
        if (!ancestor) {
          return '';
        }
        const parentValue = ancestor.stringValues[index] ?? '';
        return parentValue === child ? '' : parentValue;
      });
    }
  }

  if (!normalized.colors && stringMetadata.length > 1) {
    const colorMetaCandidate = [...stringMetadata]
      .reverse()
      .find(meta => (mostSpecificStringMeta ? meta.key !== mostSpecificStringMeta.key : true) && meta.uniqueCount > 1);
    if (colorMetaCandidate) {
      normalized.colors = [...colorMetaCandidate.stringValues];
    }
  }

  return normalized;
};

interface ChartWizardProps {
  data: ChartDataSource;
  onSave: (chartConfig: ChartPayload) => void;
  onCancel: () => void;
}

const isDateArray = (values: ValueArray | undefined): values is Date[] =>
  Array.isArray(values) && values.every(value => value instanceof Date);

const determineSuggestedChartType = (data: ChartDataShape): ChartType => {
  const hasHierarchy = Array.isArray(data.parents) && data.parents.length > 0 && data.parents.some(parent => parent && parent.length > 0);
  if (hasHierarchy) {
    return 'treemap';
  }

  const hasMatrix = Array.isArray(data.matrix) || Array.isArray(data.z);
  if (hasMatrix) {
    return 'heatmap';
  }

  const seriesCount = data.series?.length ?? 0;
  const hasDateAxis = isDateArray(data.x as ValueArray | undefined);

  const resolveArray = (values: unknown): ValueArray | undefined => {
    if (Array.isArray(values)) {
      return values as ValueArray;
    }
    return undefined;
  };

  const resolvedX = resolveArray(data.x) ?? resolveArray(data.xValues);
  const resolvedY = resolveArray(data.y) ?? resolveArray(data.yValues) ?? resolveArray(data.values);

  const isNumericArray = (values: ValueArray | undefined): boolean => {
    if (!values || values.length === 0) return false;
    return values.every(value =>
      value instanceof Date ? false : typeof value === 'number' ? Number.isFinite(value) : isNumericValue(value)
    );
  };

  const hasScatterAxes = !hasDateAxis && isNumericArray(resolvedX) && isNumericArray(resolvedY);

  const sizeCandidates = typeof data.sizes === 'number'
    ? [data.sizes]
    : Array.isArray(data.sizes)
      ? data.sizes
      : [];
  const numericSizes = sizeCandidates
    .map(size => (typeof size === 'number' ? size : Number(size)))
    .filter(size => Number.isFinite(size));
  const hasSizeDimension = numericSizes.length > 0 && new Set(numericSizes).size > 1;

  if (hasScatterAxes) {
    if (hasSizeDimension) {
      return 'bubble';
    }
    return 'scatter';
  }

  if (seriesCount > 1) {
    return hasDateAxis ? 'multi-line' : 'grouped-bar';
  }

  if (hasDateAxis) {
    return 'line';
  }

  if ((data.values ?? []).length > 0) {
    return 'bar';
  }

  return 'pie';
};

export default function ChartWizard({ data, onSave, onCancel }: ChartWizardProps): React.JSX.Element {
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [chartData, setChartData] = useState<PlotTrace[] | null>(null);
  const [chartLayout, setChartLayout] = useState<PlotLayout>({});

  const normalizedData = useMemo<ChartDataShape>(() => {
    if (Array.isArray(data)) {
      return buildDataFromRows(data);
    }

    return data;
  }, [data]);

  const suggestedChartType = useMemo<ChartType>(() => determineSuggestedChartType(normalizedData), [normalizedData]);

  useEffect(() => {
    if (!selectedChart) {
      setSelectedChart(suggestedChartType);
    }
  }, [selectedChart, suggestedChartType]);

  const generateChartData = useCallback(() => {
    const chart = CHART_CATALOG.find(c => c.type === selectedChart);
    if (!chart) return;

    // Transform data based on chart type
    let traces: PlotTrace[] = [];
    const layout: PlotLayout = {
      title: chartTitle || `${chart.name} Analysis`,
      showlegend: true,
      hovermode: 'closest',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: '#6b7280'
      },
      margin: { t: 40, r: 20, b: 40, l: 60 }
    };

    const candidateXArrays: Array<ValueArray | undefined> = [
      normalizedData.x as ValueArray | undefined,
      normalizedData.labels as ValueArray | undefined,
      normalizedData.categories as ValueArray | undefined
    ];

    const baseXCandidate = candidateXArrays.find(arr => Array.isArray(arr) && arr.length > 0);
    const inferredLength =
      baseXCandidate?.length ??
      normalizedData.values?.length ??
      normalizedData.series?.[0]?.values.length ??
      normalizedData.rawRows?.length ??
      0;

    const generatedIndex: ValueArray = Array.from(
      { length: inferredLength > 0 ? inferredLength : 1 },
      (_, index) => index + 1
    );

    const baseX: ValueArray = (baseXCandidate as ValueArray | undefined) ?? generatedIndex;
    const targetLength = baseX.length;

    const seriesList =
      (normalizedData.series ?? []).map(series => ({
        key: series.key,
        name: series.name,
        values: series.values.slice(0, targetLength)
      })).filter(series =>
        series.values.length === targetLength &&
        series.values.some(value => Number.isFinite(value))
      );

    const primarySeriesValues = (normalizedData.values ?? seriesList[0]?.values ?? []).slice(0, targetLength);
    const categories: ValueArray = ((normalizedData.labels as ValueArray | undefined)
      ?? (normalizedData.categories as ValueArray | undefined)
      ?? baseX).slice(0, targetLength) as ValueArray;

    const hasDateAxis = isDateArray(normalizedData.x as ValueArray | undefined);

    if (hasDateAxis) {
      layout.xaxis = {
        type: 'date',
        automargin: true
      };
    }

    switch (selectedChart) {
      case 'line':
        traces = [{
          type: 'scatter',
          mode: 'lines+markers',
          x: baseX,
          y: primarySeriesValues,
          name: normalizedData.name || 'Series 1',
          line: { shape: 'spline', smoothing: 1.3 }
        }];
        break;

      case 'multi-line': {
        const lineSeries = seriesList.length > 0
          ? seriesList
          : [{
              key: 'series-1',
              name: normalizedData.name || 'Series 1',
              values: primarySeriesValues
            }];

        traces = lineSeries.map((serie, index) => ({
          type: 'scatter',
          mode: 'lines+markers',
          x: baseX,
          y: serie.values,
          name: serie.name || `Series ${index + 1}`,
          line: { shape: 'spline', smoothing: 1.3 }
        }));
        break;
      }

      case 'area':
        traces = [{
          type: 'scatter',
          mode: 'lines',
          x: baseX,
          y: primarySeriesValues,
          fill: 'tozeroy',
          fillcolor: 'rgba(59, 130, 246, 0.3)',
          line: { color: '#3b82f6' }
        }];
        break;

      case 'stacked-area': {
        const areaSeries = seriesList.length > 0
          ? seriesList
          : [{
              key: 'series-1',
              name: normalizedData.name || 'Series 1',
              values: primarySeriesValues
            }];

        traces = areaSeries.map((serie, index) => ({
          type: 'scatter',
          mode: 'lines',
          x: baseX,
          y: serie.values,
          stackgroup: 'one',
          name: serie.name || `Series ${index + 1}`,
          line: { shape: 'spline', smoothing: 1.3 },
          fill: index === 0 ? 'tozeroy' : 'tonexty'
        }));
        break;
      }

      case 'bar':
      case 'grouped-bar':
      case 'stacked-bar': {
        if (selectedChart === 'bar' || seriesList.length === 0) {
          traces = [{
            type: 'bar',
            x: categories,
            y: primarySeriesValues,
            marker: {
              color: '#3b82f6',
              line: { width: 1, color: 'rgba(0,0,0,0.1)' }
            }
          }];
        } else {
          traces = seriesList.map((serie, index) => ({
            type: 'bar',
            x: categories,
            y: serie.values,
            name: serie.name || `Series ${index + 1}`,
            marker: {
              line: { width: 1, color: 'rgba(0,0,0,0.1)' }
            }
          }));
        }
        if (selectedChart === 'stacked-bar') {
          layout.barmode = 'stack';
        } else if (selectedChart === 'grouped-bar') {
          layout.barmode = 'group';
        }
        break;
      }

      case 'horizontal-bar':
        traces = [{
          type: 'bar',
          orientation: 'h',
          y: categories,
          x: primarySeriesValues,
          marker: {
            color: '#3b82f6'
          }
        }];
        break;

      case 'pie':
      case 'donut':
        traces = [{
          type: 'pie',
          labels: normalizedData.labels || normalizedData.names || normalizedData.categories,
          values: normalizedData.values || normalizedData.amounts,
          hole: selectedChart === 'donut' ? 0.4 : 0,
          textposition: 'inside',
          textinfo: 'label+percent'
        }];
        break;

      case 'scatter':
      case 'bubble': {
        const scatterX = (normalizedData.x as ValueArray | undefined) ?? normalizedData.xValues ?? baseX;
        const scatterY = (normalizedData.y as ValueArray | undefined) ?? normalizedData.yValues ?? primarySeriesValues;

        const rawSize = typeof normalizedData.sizes === 'number'
          ? normalizedData.sizes
          : Array.isArray(normalizedData.sizes)
            ? normalizedData.sizes.slice(0, targetLength)
            : undefined;

        const sizeFallback = selectedChart === 'bubble' && !rawSize && seriesList.length > 1
          ? seriesList[1]?.values?.slice(0, targetLength)
          : undefined;

        const resolvedSize = rawSize ?? sizeFallback ?? (selectedChart === 'bubble' ? 12 : 8);

        const resolvedColor = Array.isArray(normalizedData.colors)
          ? normalizedData.colors.slice(0, targetLength)
          : typeof normalizedData.colors === 'string'
            ? normalizedData.colors
            : '#3b82f6';

        const marker: Record<string, unknown> = {
          size: resolvedSize,
          color: resolvedColor
        };

        if (selectedChart === 'bubble') {
          marker.symbol = 'circle';
          marker.sizemode = 'area';
          if (Array.isArray(resolvedSize)) {
            const numericSizes = resolvedSize.filter(value => typeof value === 'number' && Number.isFinite(value));
            const maxSize = numericSizes.length > 0 ? Math.max(...numericSizes) : 0;
            if (Number.isFinite(maxSize) && maxSize > 0) {
              marker.sizeref = (2.0 * maxSize) / (36 ** 2);
            }
          }
        }

        if (Array.isArray(resolvedColor)) {
          marker.showscale = true;
        }

        traces = [{
          type: 'scatter',
          mode: 'markers',
          x: scatterX,
          y: scatterY,
          marker
        }];
        break;
      }

      case 'heatmap':
        traces = [{
          type: 'heatmap',
          z: normalizedData.z || normalizedData.matrix,
          x: normalizedData.x || normalizedData.xLabels,
          y: normalizedData.y || normalizedData.yLabels,
          colorscale: 'Viridis'
        }];
        break;

      case 'waterfall':
        traces = [{
          type: 'waterfall',
          x: normalizedData.labels || normalizedData.categories,
          y: normalizedData.values || normalizedData.changes || primarySeriesValues,
          connector: { line: { color: 'rgb(63, 63, 63)' } }
        }];
        break;

      case 'funnel':
        traces = [{
          type: 'funnel',
          y: normalizedData.labels || normalizedData.stages,
          x: primarySeriesValues,
          textposition: 'inside',
          textinfo: 'value+percent initial'
        }];
        break;

      case 'treemap':
        traces = [{
          type: 'treemap',
          labels: normalizedData.labels || normalizedData.names,
          parents: normalizedData.parents || normalizedData.labels?.map(() => '') || [''],
          values: normalizedData.values || normalizedData.amounts,
          branchvalues: 'total',
          textinfo: 'label+value+percent parent'
        }];
        break;

      case 'sunburst':
        traces = [{
          type: 'sunburst',
          labels: normalizedData.labels || normalizedData.names,
          parents: normalizedData.parents || normalizedData.labels?.map(() => '') || [''],
          values: normalizedData.values || normalizedData.amounts
        }];
        break;

      case 'box':
      case 'violin':
        traces = [{
          type: selectedChart,
          y: normalizedData.values || normalizedData.distribution || primarySeriesValues,
          name: normalizedData.name || 'Distribution',
          box: { visible: true },
          meanline: { visible: true }
        }];
        break;

      case 'candlestick':
        traces = [{
          type: 'candlestick',
          x: normalizedData.dates || normalizedData.x,
          open: normalizedData.open,
          high: normalizedData.high,
          low: normalizedData.low,
          close: normalizedData.close
        }];
        break;

      case 'sankey':
        traces = [{
          type: 'sankey',
          node: {
            label: normalizedData.nodeLabels || normalizedData.nodes,
            color: normalizedData.nodeColors || '#3b82f6'
          },
          link: {
            source: normalizedData.linkSource || normalizedData.sources,
            target: normalizedData.linkTarget || normalizedData.targets,
            value: normalizedData.linkValue || normalizedData.values
          }
        }];
        break;

      case 'radar':
        traces = [{
          type: 'scatterpolar',
          r: normalizedData.values || normalizedData.r,
          theta: normalizedData.categories || normalizedData.theta,
          fill: 'toself',
          fillcolor: 'rgba(59, 130, 246, 0.3)',
          line: { color: '#3b82f6' }
        }];
        layout.polar = {
          radialaxis: {
            visible: true,
            range: [0, Math.max(...(Array.isArray(normalizedData.values) && normalizedData.values.length > 0
              ? normalizedData.values
              : [100]))]
          }
        };
        break;

      case 'gauge':
        traces = [{
          type: 'indicator',
          mode: 'gauge+number',
          value: normalizedData.value ?? 0,
          title: { text: normalizedData.label || 'Metric' },
          gauge: {
            axis: { range: [null, normalizedData.max ?? 100] },
            bar: { color: '#3b82f6' },
            steps: normalizedData.steps || [
              { range: [0, 50], color: 'rgba(239, 68, 68, 0.3)' },
              { range: [50, 80], color: 'rgba(251, 191, 36, 0.3)' },
              { range: [80, 100], color: 'rgba(34, 197, 94, 0.3)' }
            ]
          }
        }];
        break;

      default:
        traces = [{
          type: 'scatter',
          x: [1, 2, 3],
          y: [1, 2, 3]
        }];
    }

    setChartData(traces);
    setChartLayout(layout);
  }, [chartTitle, normalizedData, selectedChart]);

  useEffect(() => {
    if (selectedChart) {
      generateChartData();
    }
  }, [selectedChart, generateChartData]);

  const handleSave = () => {
    if (!selectedChart || !chartData) {
      return;
    }

    const config = {
      type: selectedChart,
      title: chartTitle,
      data: chartData,
      layout: chartLayout,
      options: CHART_CATALOG.find(c => c.type === selectedChart)?.defaultOptions ?? {}
    };
    onSave(config);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Chart Wizard</h2>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              {selectedChart && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Add Chart
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex h-[calc(90vh-100px)]">
          {/* Chart Selection */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
            <input
              type="text"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              className="w-full px-3 py-2 mb-4 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
              placeholder="Chart Title"
            />
            
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Chart Type</h3>
            <div className="space-y-2">
              {CHART_CATALOG.map((chart) => (
                <button
                  key={chart.type}
                  onClick={() => setSelectedChart(chart.type)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedChart === chart.type
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <ProfessionalIcon
                    name={chart.iconName}
                    size={20}
                    className={selectedChart === chart.type ? 'text-white' : 'text-gray-600 dark:text-gray-400'}
                  />
                  <div>
                    <div className={`font-medium ${selectedChart === chart.type ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {chart.name}
                    </div>
                    <div className={`text-xs mt-0.5 ${selectedChart === chart.type ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      {chart.description}
                    </div>
                    {chart.type === suggestedChartType && (
                      <span className={`inline-flex items-center px-2 py-0.5 mt-2 text-[10px] font-semibold rounded-full ${
                        selectedChart === chart.type
                          ? 'bg-white/20 text-white'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        Suggested
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chart Preview */}
          <div className="flex-1 p-6">
            {selectedChart && chartData ? (
              <div className="h-full">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
                <div className="bg-blue-50 dark:bg-gray-900 rounded-lg p-4 h-[calc(100%-3rem)]">
                  <Suspense fallback={<div className="flex items-center justify-center h-full">Loading chart...</div>}>
                    <Plot
                      data={chartData}
                      layout={{
                        ...chartLayout,
                        autosize: true,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent'
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: false
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Suspense>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <ProfessionalIcon name="chartBar" size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select a chart type to see preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
