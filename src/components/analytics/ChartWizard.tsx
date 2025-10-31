import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3Icon,
  LineChartIcon,
  PieChartIcon,
  ActivityIcon,
  GridIcon,
  LayersIcon,
  ArrowRightLeftIcon,
  LightbulbIcon
} from '../icons';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  Treemap,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';

export type ChartType =
  | 'line' | 'multi-line' | 'area' | 'stacked-area'
  | 'bar' | 'grouped-bar' | 'stacked-bar' | 'horizontal-bar'
  | 'pie' | 'donut'
  | 'scatter' | 'bubble'
  | 'radar' | 'treemap' | 'funnel';

interface ChartConfig {
  type: ChartType;
  name: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  requiredDataShape: 'single-series' | 'multi-series' | 'hierarchical' | 'time-series' | 'correlation';
  defaultOptions: Record<string, unknown>;
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
  }
];

// Color palette for charts
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

type SeriesPoint = Record<string, unknown>;

type LabelValueData = {
  labels: string[];
  values: number[];
  categories?: string[];
};

type CategoryAmountData = {
  categories: string[];
  amounts: number[];
};

type XYData = {
  x: Array<string | number>;
  y: Array<string | number>;
  sizes?: number[];
};

type ChartRecordData = Record<string, number>;

type ChartInputData = SeriesPoint[] | LabelValueData | CategoryAmountData | XYData | ChartRecordData;

interface ChartWizardProps {
  data: ChartInputData;
  onSave: (chartConfig: Record<string, unknown>) => void;
  onCancel: () => void;
}

const isLabelValueData = (input: ChartInputData): input is LabelValueData => {
  return (
    !Array.isArray(input) &&
    'labels' in input &&
    Array.isArray(input.labels) &&
    'values' in input &&
    Array.isArray(input.values)
  );
};

const isCategoryAmountData = (input: ChartInputData): input is CategoryAmountData => {
  return (
    !Array.isArray(input) &&
    'categories' in input &&
    Array.isArray(input.categories) &&
    'amounts' in input &&
    Array.isArray(input.amounts)
  );
};

const isXYData = (input: ChartInputData): input is XYData => {
  return (
    !Array.isArray(input) &&
    'x' in input &&
    Array.isArray(input.x) &&
    'y' in input &&
    Array.isArray(input.y)
  );
};

export default function ChartWizard({ data, onSave, onCancel }: ChartWizardProps): React.JSX.Element {
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [transformedData, setTransformedData] = useState<SeriesPoint[]>([]);
  const [chartConfig] = useState<Record<string, unknown>>({});

  const transformDataForChart = useCallback(() => {
    const chart = CHART_CATALOG.find(c => c.type === selectedChart);
    if (!chart) return;

    // Transform data based on chart type and expected Recharts format
    let transformed: SeriesPoint[] = [];

    // Handle different input data formats
    if (Array.isArray(data)) {
      transformed = data;
    } else if (isLabelValueData(data)) {
      // Transform label/value pairs to Recharts format
      transformed = data.labels.map((label, i) => ({
        name: label,
        value: data.values[i],
        ...(data.categories && { category: data.categories[i] })
      }));
    } else if (isCategoryAmountData(data)) {
      transformed = data.categories.map((cat, i) => ({
        name: cat,
        value: data.amounts[i]
      }));
    } else if (isXYData(data)) {
      transformed = data.x.map((xVal, i) => ({
        x: xVal,
        y: data.y[i],
        ...(data.sizes && { z: data.sizes[i] })
      }));
    } else if (data && typeof data === 'object') {
      // Fallback: use data as-is if it's already in the right format
      transformed = Object.entries(data as ChartRecordData).map(([key, value]) => ({
        name: key,
        value
      }));
    }

    setTransformedData(transformed);
  }, [data, selectedChart]);

  useEffect(() => {
    if (selectedChart) {
      transformDataForChart();
    }
  }, [selectedChart, transformDataForChart]);

  const renderChart = () => {
    if (!selectedChart || !transformedData.length) return null;

    switch (selectedChart) {
      case 'line':
      case 'multi-line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={transformedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
      case 'stacked-area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={transformedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
      case 'grouped-bar':
      case 'stacked-bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={transformedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontal-bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={transformedData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis type="category" dataKey="name" stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={transformedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''}: ${percent !== undefined ? (percent * 100).toFixed(0) : '0'}%`
                }
                outerRadius={selectedChart === 'donut' ? 120 : 150}
                innerRadius={selectedChart === 'donut' ? 60 : 0}
                fill="#8884d8"
                dataKey="value"
              >
                {transformedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
      case 'bubble':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" dataKey="x" stroke="#6b7280" />
              <YAxis type="number" dataKey="y" stroke="#6b7280" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Scatter
                data={transformedData}
                fill="#3b82f6"
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={transformedData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="name" stroke="#6b7280" />
              <PolarRadiusAxis stroke="#6b7280" />
              <Radar
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'treemap':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={transformedData}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#3b82f6"
            >
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        );

      case 'funnel':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Funnel
                dataKey="value"
                data={transformedData}
                isAnimationActive
              >
                <LabelList position="center" fill="#fff" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const handleSave = () => {
    const config = {
      type: selectedChart,
      title: chartTitle,
      data: transformedData,
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
            {selectedChart && transformedData.length > 0 ? (
              <div className="h-full">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-[calc(100%-3rem)]">
                  {renderChart()}
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
