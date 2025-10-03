import { useState, useEffect, lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import {
  BarChart3Icon,
  LineChartIcon,
  PieChartIcon,
  TrendingUpIcon,
  ActivityIcon,
  GridIcon,
  LayersIcon,
  ArrowRightLeftIcon,
  LightbulbIcon
} from '../icons';
import { useApp } from '../../contexts/AppContextSupabase';
import { analyticsEngine } from '../../services/analyticsEngine';

// Lazy load Plotly to reduce bundle size
const Plot = lazy(() => import('react-plotly.js')) as unknown as LazyExoticComponent<ComponentType<any>>;

interface ChartOptions {
  showLegend?: boolean;
  showGrid?: boolean;
  smoothing?: number;
  interpolation?: string;
  fillOpacity?: number;
  showDataPoints?: boolean;
  stackMode?: string;
  orientation?: string;
  showValues?: boolean;
  barMode?: string;
  innerRadius?: number;
  showLabels?: boolean;
  showPercentages?: boolean;
  hierarchy?: string[];
  textOrientation?: string;
  colorScale?: string;
  showTooltip?: boolean;
  bubbleSizeField?: string;
  maxBubbleSize?: number;
  absoluteValues?: boolean;
  connectorStyle?: string;
  arrangement?: string;
  linkOpacity?: number;
  nodeWidth?: number;
  scaleType?: string;
  targetValue?: number;
  // Allow additional chart-specific options used in catalog defaults
  [key: string]: unknown;
}

interface PlotlyTrace {
  type?: string;
  x?: Array<string | number | Date>;
  y?: Array<string | number | Date>;
  name?: string;
  mode?: string;
  fill?: string;
  fillcolor?: string;
  line?: { color?: string; shape?: string; smoothing?: number };
  stackgroup?: string;
  orientation?: string;
  text?: string[];
  textposition?: string;
  textinfo?: string;
  connector?: { line?: { color?: string; width?: number } };
  marker?: {
    color?: string | string[];
    size?: number | number[];
    sizemode?: 'diameter' | 'area' | string;
    sizeref?: number;
    showscale?: boolean;
    opacity?: number | number[];
    symbol?: string | string[];
    colorscale?: string | Array<[number, string]>;
    coloraxis?: string;
    colorbar?: Record<string, unknown>;
    line?: { width?: number; color?: string };
  };
  labels?: string[];
  values?: number[];
  hole?: number;
  parents?: string[];
  ids?: string[];
  z?: number[][];
  colorscale?: string;
  open?: number[];
  high?: number[];
  low?: number[];
  close?: number[];
  box?: { visible?: boolean };
  meanline?: { visible?: boolean };
  node?: { label?: string[]; color?: string | string[] };
  link?: { source?: number[]; target?: number[]; value?: number[] };
  title?: { text?: string };
  gauge?: {
    axis?: { range?: [number | null, number] };
    bar?: { color?: string };
    steps?: Array<{ range: [number, number]; color: string }>;
    threshold?: { line?: { color?: string; width?: number }; thickness?: number; value?: number };
  };
  [key: string]: unknown;
}

interface PlotlyLayout {
  title?: string;
  xaxis?: {
    title?: string;
    showgrid?: boolean;
    type?: string;
  };
  yaxis?: {
    title?: string;
    showgrid?: boolean;
    type?: string;
  };
  barmode?: string;
  showlegend?: boolean;
  hovermode?: string;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  font?: { color?: string; family?: string; size?: number };
  margin?: {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
  };
  height?: number;
  width?: number;
  polar?: { radialaxis?: { visible?: boolean; range?: [number, number] } };
  [key: string]: unknown;
}

interface ChartConfiguration {
  type: ChartType;
  dataSource?: string;
  xAxis?: string;
  yAxis?: string;
  series?: string[];
  aggregation?: string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  options?: ChartOptions;
}

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
  icon: React.FC<{ size?: number; className?: string }>;
  requiredDataShape: 'single-series' | 'multi-series' | 'hierarchical' | 'time-series' | 'correlation';
  defaultOptions: ChartOptions;
}

const CHART_CATALOG: ChartConfig[] = [
  // Line Charts
  {
    type: 'line',
    name: 'Line Chart',
    description: 'Track trends over time',
    icon: LineChartIcon,
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
    icon: ActivityIcon,
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
    icon: LineChartIcon,
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
    icon: LayersIcon,
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
    icon: BarChart3Icon,
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
    icon: BarChart3Icon,
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
    icon: BarChart3Icon,
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
    icon: PieChartIcon,
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
    icon: PieChartIcon,
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
    icon: PieChartIcon,
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
    icon: GridIcon,
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
    icon: GridIcon,
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
    icon: GridIcon,
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
    icon: TrendingUpIcon,
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
    icon: BarChart3Icon,
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
    icon: BarChart3Icon,
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
    icon: BarChart3Icon,
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
    icon: GridIcon,
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
    icon: LayersIcon,
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
    icon: ArrowRightLeftIcon,
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
    icon: LightbulbIcon,
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
    icon: TrendingUpIcon,
    requiredDataShape: 'single-series',
    defaultOptions: {
      min: 0,
      max: 100,
      showThresholds: true
    }
  }
];

interface ChartWizardProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  onSave: (chartConfig: ChartConfiguration) => void;
  onCancel: () => void;
}

export default function ChartWizard({ data, onSave, onCancel }: ChartWizardProps): React.JSX.Element {
  // Narrow the flexible data shape into a predictable structure for plotting
  type SeriesData = {
    labels?: Array<string | number | Date>; x?: Array<string | number | Date>; y?: Array<string | number | Date>; values?: Array<number>;
    categories?: Array<string>; amounts?: Array<number>; name?: string;
    sizes?: number[] | number; colors?: string | string[];
    z?: number[][]; matrix?: number[][]; xLabels?: Array<string | number | Date>; yLabels?: Array<string | number | Date>;
    changes?: number[]; stages?: string[];
    names?: string[]; parents?: string[]; distribution?: number[];
    dates?: Array<string | Date>; open?: number[]; high?: number[]; low?: number[]; close?: number[];
    nodeLabels?: string[]; nodes?: string[]; nodeColors?: string[] | string;
    linkSource?: number[]; sources?: number[]; linkTarget?: number[]; targets?: number[]; linkValue?: number[];
    r?: number[]; theta?: string[];
    value?: number; label?: string; max?: number; steps?: Array<{ range: [number, number]; color: string }>;
  };

  const d = (Array.isArray(data) ? {} : data) as unknown as SeriesData;
  // Helpers to safely coerce inputs to arrays expected by Plotly
  const toArray = <T,>(val: T | T[] | undefined): T[] | undefined =>
    val === undefined ? undefined : (Array.isArray(val) ? val : [val]);
  const toNumArray = (val: unknown): number[] | undefined => {
    const arr = Array.isArray(val) ? val : val === undefined ? undefined : [val];
    return arr?.map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => !Number.isNaN(v));
  };
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [chartData, setChartData] = useState<PlotlyTrace[] | null>(null);
  const [chartLayout, setChartLayout] = useState<PlotlyLayout>({});
  const [chartConfig, setChartConfig] = useState<ChartConfiguration>({} as ChartConfiguration);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (selectedChart && data) {
      generateChartData();
    }
  }, [selectedChart, data]);

  const generateChartData = () => {
    const chart = CHART_CATALOG.find(c => c.type === selectedChart);
    if (!chart) return;

    // Transform data based on chart type
    let traces: PlotlyTrace[] = [];
    const layout: PlotlyLayout = {
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

    switch (selectedChart) {
      case 'line':
      case 'multi-line':
        traces = [{
          type: 'scatter',
          mode: 'lines+markers',
          x: toArray(d.labels) ?? toArray(d.x),
          y: toNumArray(d.values) ?? toNumArray(d.y),
          name: d.name || 'Series 1',
          line: { shape: 'spline', smoothing: 1.3 }
        }];
        break;

      case 'area':
      case 'stacked-area':
        traces = [{
          type: 'scatter',
          mode: 'lines',
          x: toArray(d.labels) ?? toArray(d.x),
          y: toNumArray(d.values) ?? toNumArray(d.y),
          fill: 'tozeroy',
          fillcolor: 'rgba(59, 130, 246, 0.3)',
          line: { color: '#3b82f6' }
        }];
        break;

      case 'bar':
      case 'grouped-bar':
      case 'stacked-bar':
        traces = [{
          type: 'bar',
          x: toArray(d.labels) ?? toArray(d.categories),
          y: toNumArray(d.values) ?? toNumArray(d.amounts),
          marker: {
            color: '#3b82f6',
            line: { width: 1, color: 'rgba(0,0,0,0.1)' }
          }
        }];
        if (selectedChart === 'stacked-bar') {
          layout.barmode = 'stack';
        } else if (selectedChart === 'grouped-bar') {
          layout.barmode = 'group';
        }
        break;

      case 'horizontal-bar':
        traces = [{
          type: 'bar',
          orientation: 'h',
          y: toArray(d.labels) ?? toArray(d.categories),
          x: toNumArray(d.values) ?? toNumArray(d.amounts),
          marker: {
            color: '#3b82f6'
          }
        }];
        break;

      case 'pie':
      case 'donut':
        traces = [{
          type: 'pie',
          labels: (toArray(d.labels) ?? toArray(d.categories)) as string[] | undefined,
          values: toNumArray(d.values) ?? toNumArray(d.amounts),
          hole: selectedChart === 'donut' ? 0.4 : 0,
          textposition: 'inside',
          textinfo: 'label+percent'
        }];
        break;

      case 'scatter':
      case 'bubble':
        traces = [{
          type: 'scatter',
          mode: 'markers',
          x: toArray(d.x) ?? toArray((d as any).xValues),
          y: toArray(d.y) ?? toArray((d as any).yValues),
          marker: {
            size: selectedChart === 'bubble' ? (Array.isArray(d.sizes) ? d.sizes : (d.sizes !== undefined ? [d.sizes] : 10)) : 8,
            color: d.colors || '#3b82f6',
            showscale: selectedChart === 'bubble'
          }
        }];
        break;

      case 'heatmap':
        traces = [{
          type: 'heatmap',
          z: d.z || (d as any).matrix,
          x: toArray(d.x) ?? toArray((d as any).xLabels),
          y: toArray(d.y) ?? toArray((d as any).yLabels),
          colorscale: 'Viridis'
        }];
        break;

      case 'waterfall':
        traces = [{
          type: 'waterfall',
          x: toArray(d.labels) ?? toArray(d.categories),
          y: toNumArray(d.values) ?? toNumArray((d as any).changes),
          connector: { line: { color: 'rgb(63, 63, 63)' } }
        }];
        break;

      case 'funnel':
        traces = [{
          type: 'funnel',
          y: toArray(d.labels) ?? toArray((d as any).stages),
          x: toNumArray(d.values) ?? toNumArray(d.amounts),
          textposition: 'inside',
          textinfo: 'value+percent initial'
        }];
        break;

      case 'treemap':
        traces = [{
          type: 'treemap',
          labels: (toArray(d.labels) ?? toArray((d as any).names)) as string[] | undefined,
          parents: d.parents || [''],
          values: toNumArray(d.values) ?? toNumArray(d.amounts),
          textinfo: 'label+value+percent parent'
        }];
        break;

      case 'sunburst':
        traces = [{
          type: 'sunburst',
          labels: (toArray(d.labels) ?? toArray((d as any).names)) as string[] | undefined,
          parents: d.parents || [''],
          values: toNumArray(d.values) ?? toNumArray(d.amounts)
        }];
        break;

      case 'box':
      case 'violin':
        traces = [{
          type: selectedChart,
          y: toNumArray(d.values) ?? toNumArray((d as any).distribution),
          name: d.name || 'Distribution',
          box: { visible: true },
          meanline: { visible: true }
        }];
        break;

      case 'candlestick':
        traces = [{
          type: 'candlestick',
          x: (toArray((d as any).dates) ?? toArray(d.x)) as Array<string | number | Date> | undefined,
          open: (d as any).open,
          high: (d as any).high,
          low: (d as any).low,
          close: (d as any).close
        }];
        break;

      case 'sankey':
        traces = [{
          type: 'sankey',
          node: {
            label: (d as any).nodeLabels || (d as any).nodes,
            color: (d as any).nodeColors || '#3b82f6'
          },
          link: {
            source: (d as any).linkSource || (d as any).sources,
            target: (d as any).linkTarget || (d as any).targets,
            value: (d as any).linkValue || d.values
          }
        }];
        break;

      case 'radar':
        traces = [{
          type: 'scatterpolar',
          r: toNumArray(d.values) ?? toNumArray((d as any).r),
          theta: (toArray(d.categories) ?? toArray((d as any).theta)) as string[] | undefined,
          fill: 'toself',
          fillcolor: 'rgba(59, 130, 246, 0.3)',
          line: { color: '#3b82f6' }
        }];
        layout.polar = {
          radialaxis: {
            visible: true,
            range: [0, Math.max(...((d.values as number[] | undefined) || [100]))]
          }
        };
        break;

      case 'gauge':
        traces = [{
          type: 'indicator',
          mode: 'gauge+number',
          value: d.value || 0,
          title: { text: d.label || 'Metric' },
          gauge: {
            axis: { range: [null as unknown as number, d.max || 100] },
            bar: { color: '#3b82f6' },
            steps: d.steps || [
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
  };

  const handleSave = () => {
    if (!selectedChart || !chartData) return;
    const config: ChartConfiguration = {
      type: selectedChart,
      options: chartConfig.options,
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
                  <chart.icon size={20} className={selectedChart === chart.type ? 'text-white' : 'text-gray-600 dark:text-gray-400'} />
                  <div>
                    <div className={`font-medium ${selectedChart === chart.type ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {chart.name}
                    </div>
                    <div className={`text-xs mt-0.5 ${selectedChart === chart.type ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      {chart.description}
                    </div>
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
                  <BarChart3Icon size={48} className="mx-auto mb-4 opacity-50" />
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
