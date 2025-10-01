import React, { useState, useEffect, lazy, Suspense } from 'react';
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
  icon: React.FC<{ size?: number; className?: string }>;
  requiredDataShape: 'single-series' | 'multi-series' | 'hierarchical' | 'time-series' | 'correlation';
  defaultOptions: any;
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
  data: any;
  onSave: (chartConfig: any) => void;
  onCancel: () => void;
}

export default function ChartWizard({ data, onSave, onCancel }: ChartWizardProps): React.JSX.Element {
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [chartData, setChartData] = useState<any>(null);
  const [chartLayout, setChartLayout] = useState<any>({});
  const [chartConfig, setChartConfig] = useState<any>({});
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
    let traces: any[] = [];
    const layout: any = {
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
          x: data.labels || data.x,
          y: data.values || data.y,
          name: data.name || 'Series 1',
          line: { shape: 'spline', smoothing: 1.3 }
        }];
        break;

      case 'area':
      case 'stacked-area':
        traces = [{
          type: 'scatter',
          mode: 'lines',
          x: data.labels || data.x,
          y: data.values || data.y,
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
          x: data.labels || data.categories,
          y: data.values || data.amounts,
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
          y: data.labels || data.categories,
          x: data.values || data.amounts,
          marker: {
            color: '#3b82f6'
          }
        }];
        break;

      case 'pie':
      case 'donut':
        traces = [{
          type: 'pie',
          labels: data.labels || data.categories,
          values: data.values || data.amounts,
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
          x: data.x || data.xValues,
          y: data.y || data.yValues,
          marker: {
            size: selectedChart === 'bubble' ? (data.sizes || 10) : 8,
            color: data.colors || '#3b82f6',
            showscale: selectedChart === 'bubble'
          }
        }];
        break;

      case 'heatmap':
        traces = [{
          type: 'heatmap',
          z: data.z || data.matrix,
          x: data.x || data.xLabels,
          y: data.y || data.yLabels,
          colorscale: 'Viridis'
        }];
        break;

      case 'waterfall':
        traces = [{
          type: 'waterfall',
          x: data.labels || data.categories,
          y: data.values || data.changes,
          connector: { line: { color: 'rgb(63, 63, 63)' } }
        }];
        break;

      case 'funnel':
        traces = [{
          type: 'funnel',
          y: data.labels || data.stages,
          x: data.values || data.amounts,
          textposition: 'inside',
          textinfo: 'value+percent initial'
        }];
        break;

      case 'treemap':
        traces = [{
          type: 'treemap',
          labels: data.labels || data.names,
          parents: data.parents || [''],
          values: data.values || data.amounts,
          textinfo: 'label+value+percent parent'
        }];
        break;

      case 'sunburst':
        traces = [{
          type: 'sunburst',
          labels: data.labels || data.names,
          parents: data.parents || [''],
          values: data.values || data.amounts
        }];
        break;

      case 'box':
      case 'violin':
        traces = [{
          type: selectedChart,
          y: data.values || data.distribution,
          name: data.name || 'Distribution',
          box: { visible: true },
          meanline: { visible: true }
        }];
        break;

      case 'candlestick':
        traces = [{
          type: 'candlestick',
          x: data.dates || data.x,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close
        }];
        break;

      case 'sankey':
        traces = [{
          type: 'sankey',
          node: {
            label: data.nodeLabels || data.nodes,
            color: data.nodeColors || '#3b82f6'
          },
          link: {
            source: data.linkSource || data.sources,
            target: data.linkTarget || data.targets,
            value: data.linkValue || data.values
          }
        }];
        break;

      case 'radar':
        traces = [{
          type: 'scatterpolar',
          r: data.values || data.r,
          theta: data.categories || data.theta,
          fill: 'toself',
          fillcolor: 'rgba(59, 130, 246, 0.3)',
          line: { color: '#3b82f6' }
        }];
        layout.polar = {
          radialaxis: {
            visible: true,
            range: [0, Math.max(...(data.values || [100]))]
          }
        };
        break;

      case 'gauge':
        traces = [{
          type: 'indicator',
          mode: 'gauge+number',
          value: data.value || 0,
          title: { text: data.label || 'Metric' },
          gauge: {
            axis: { range: [null, data.max || 100] },
            bar: { color: '#3b82f6' },
            steps: data.steps || [
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
    const config = {
      type: selectedChart,
      title: chartTitle,
      data: chartData,
      layout: chartLayout,
      options: chartConfig
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
