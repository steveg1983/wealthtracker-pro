import { ChartType } from '../components/analytics/chartCatalog';
import type { PlotlyTrace, PlotlyLayout } from '../components/analytics/ChartPreview';

export interface ChartData {
  labels?: Array<string | number | Date>;
  values?: number[];
  categories?: string[];
  amounts?: number[];
  x?: Array<string | number | Date>;
  y?: Array<string | number | Date>;
  xValues?: number[];
  yValues?: number[];
  sizes?: number[] | number;
  colors?: string[];
  z?: number[][];
  matrix?: number[][];
  xLabels?: string[];
  yLabels?: string[];
  changes?: number[];
  stages?: string[];
  names?: string[];
  parents?: string[];
  name?: string;
  [key: string]: unknown;
}

export class ChartDataGenerator {
  static generateChartData(
    chartType: ChartType,
    data: ChartData,
    title?: string
  ): { traces: PlotlyTrace[]; layout: PlotlyLayout } {
    let traces: PlotlyTrace[] = [];
    const layout: PlotlyLayout = {
      title: title || 'Chart Analysis',
      showlegend: true,
      hovermode: 'closest',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: '#6b7280'
      },
      margin: { t: 40, r: 20, b: 40, l: 60 }
    };

    switch (chartType) {
      case 'line':
      case 'multi-line':
        traces = this.generateLineChart(data);
        break;

      case 'area':
      case 'stacked-area':
        traces = this.generateAreaChart(data, chartType === 'stacked-area');
        break;

      case 'bar':
      case 'grouped-bar':
      case 'stacked-bar':
        traces = this.generateBarChart(data, chartType);
        if (chartType === 'stacked-bar') {
          layout.barmode = 'stack';
        } else if (chartType === 'grouped-bar') {
          layout.barmode = 'group';
        }
        break;

      case 'horizontal-bar':
        traces = this.generateHorizontalBarChart(data);
        break;

      case 'pie':
      case 'donut':
        traces = this.generatePieChart(data, chartType === 'donut');
        break;

      case 'scatter':
      case 'bubble':
        traces = this.generateScatterChart(data, chartType === 'bubble');
        break;

      case 'heatmap':
        traces = this.generateHeatmap(data);
        break;

      case 'waterfall':
        traces = this.generateWaterfall(data);
        break;

      case 'funnel':
        traces = this.generateFunnel(data);
        break;

      case 'treemap':
        traces = this.generateTreemap(data);
        break;

      case 'sunburst':
        traces = this.generateSunburst(data);
        break;

      default:
        traces = this.generateLineChart(data);
    }

    return { traces, layout };
  }

  private static generateLineChart(data: ChartData): PlotlyTrace[] {
    return [{
      type: 'scatter',
      mode: 'lines+markers',
      x: data.labels || data.x,
      y: data.values || data.y,
      name: data.name || 'Series 1',
      line: { shape: 'spline', smoothing: 1.3 }
    }];
  }

  private static generateAreaChart(data: ChartData, stacked: boolean): PlotlyTrace[] {
    const trace: PlotlyTrace = {
      type: 'scatter',
      mode: 'lines',
      x: data.labels || data.x,
      y: data.values || data.y,
      fill: 'tozeroy',
      fillcolor: 'rgba(59, 130, 246, 0.3)',
      line: { color: '#3b82f6' }
    };

    if (stacked && data.stackgroup) {
      trace.stackgroup = String(data.stackgroup);
    }

    return [trace];
  }

  private static generateBarChart(data: ChartData, variant: ChartType): PlotlyTrace[] {
    return [{
      type: 'bar',
      x: data.labels || data.categories,
      y: data.values || data.amounts,
      marker: {
        color: '#3b82f6',
        line: { width: 1, color: 'rgba(0,0,0,0.1)' }
      }
    }];
  }

  private static generateHorizontalBarChart(data: ChartData): PlotlyTrace[] {
    return [{
      type: 'bar',
      orientation: 'h',
      y: data.labels || data.categories,
      x: data.values || data.amounts,
      marker: {
        color: '#3b82f6'
      }
    }];
  }

  private static generatePieChart(data: ChartData, isDonut: boolean): PlotlyTrace[] {
    const labels = (data.labels || data.categories || []).map(l => String(l));
    return [{
      type: 'pie',
      labels,
      values: data.values || data.amounts,
      hole: isDonut ? 0.4 : 0,
      textposition: 'inside',
      textinfo: 'label+percent'
    }];
  }

  private static generateScatterChart(data: ChartData, isBubble: boolean): PlotlyTrace[] {
    return [{
      type: 'scatter',
      mode: 'markers',
      x: data.x || data.xValues,
      y: data.y || data.yValues,
      marker: {
        size: isBubble ? (data.sizes || 10) : 8,
        color: data.colors || '#3b82f6',
        showscale: isBubble
      }
    }];
  }

  private static generateHeatmap(data: ChartData): PlotlyTrace[] {
    return [{
      type: 'heatmap',
      z: data.z || data.matrix,
      x: data.x || data.xLabels,
      y: data.y || data.yLabels,
      colorscale: 'Viridis'
    }];
  }

  private static generateWaterfall(data: ChartData): PlotlyTrace[] {
    return [{
      type: 'waterfall',
      x: data.labels || data.categories,
      y: data.values || data.changes,
      connector: { line: { color: 'rgb(63, 63, 63)' } }
    }];
  }

  private static generateFunnel(data: ChartData): PlotlyTrace[] {
    return [{
      type: 'funnel',
      y: data.labels || data.stages,
      x: data.values || data.amounts,
      textposition: 'inside',
      textinfo: 'value+percent initial'
    }];
  }

  private static generateTreemap(data: ChartData): PlotlyTrace[] {
    const labels = (data.labels || data.names || []).map(l => String(l));
    return [{
      type: 'treemap',
      labels,
      parents: data.parents || [''],
      values: data.values || data.amounts
    }];
  }

  private static generateSunburst(data: ChartData): PlotlyTrace[] {
    const labels = (data.labels || data.names || []).map(l => String(l));
    return [{
      type: 'sunburst',
      labels,
      parents: data.parents || [''],
      values: data.values || data.amounts
    }];
  }
}
