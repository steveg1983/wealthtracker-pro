import {
  BarChart3Icon,
  LineChartIcon,
  PieChartIcon,
  ActivityIcon,
  LayersIcon,
  GridIcon
} from '../icons';

export type ChartType = 
  | 'line' | 'multi-line' | 'area' | 'stacked-area'
  | 'bar' | 'grouped-bar' | 'stacked-bar' | 'horizontal-bar'
  | 'pie' | 'donut' | 'sunburst'
  | 'scatter' | 'bubble' | 'heatmap'
  | 'waterfall' | 'funnel' | 'treemap'
  | 'candlestick' | 'box' | 'violin'
  | 'sankey' | 'radar' | 'gauge';

export interface ChartOptions {
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
  holeSize?: number;
  showCenterMetric?: boolean;
  maxDepth?: number;
  showPath?: boolean;
  barGap?: number;
  showTotals?: boolean;
  // Allow additional chart-specific options without tightening the public contract
  [key: string]: unknown;
}

export interface ChartConfig {
  type: ChartType;
  name: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  requiredDataShape: 'single-series' | 'multi-series' | 'hierarchical' | 'time-series' | 'correlation';
  defaultOptions: ChartOptions;
}

export const CHART_CATALOG: ChartConfig[] = [
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
  {
    type: 'horizontal-bar',
    name: 'Horizontal Bar',
    description: 'Compare with horizontal layout',
    icon: BarChart3Icon,
    requiredDataShape: 'single-series',
    defaultOptions: {
      orientation: 'horizontal',
      showValues: true
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
  
  // Advanced Charts
  {
    type: 'scatter',
    name: 'Scatter Plot',
    description: 'Show correlations',
    icon: ActivityIcon,
    requiredDataShape: 'correlation',
    defaultOptions: {
      showGrid: true,
      showLegend: true
    }
  },
  {
    type: 'bubble',
    name: 'Bubble Chart',
    description: 'Show three dimensions',
    icon: ActivityIcon,
    requiredDataShape: 'correlation',
    defaultOptions: {
      maxBubbleSize: 50,
      showLegend: true
    }
  },
  {
    type: 'heatmap',
    name: 'Heatmap',
    description: 'Show intensity patterns',
    icon: GridIcon,
    requiredDataShape: 'correlation',
    defaultOptions: {
      colorScale: 'Viridis',
      showTooltip: true
    }
  },
  {
    type: 'waterfall',
    name: 'Waterfall',
    description: 'Show progressive changes',
    icon: BarChart3Icon,
    requiredDataShape: 'single-series',
    defaultOptions: {
      connectorStyle: 'solid',
      absoluteValues: false
    }
  },
  {
    type: 'funnel',
    name: 'Funnel',
    description: 'Show conversion stages',
    icon: BarChart3Icon,
    requiredDataShape: 'single-series',
    defaultOptions: {
      arrangement: 'stacked',
      showPercentages: true
    }
  },
  {
    type: 'treemap',
    name: 'Treemap',
    description: 'Show hierarchical data',
    icon: GridIcon,
    requiredDataShape: 'hierarchical',
    defaultOptions: {
      textOrientation: 'horizontal',
      maxDepth: 3
    }
  }
];

export function getChartByType(type: ChartType): ChartConfig | undefined {
  return CHART_CATALOG.find(chart => chart.type === type);
}
