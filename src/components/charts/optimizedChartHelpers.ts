import { CHART_COLORS } from './OptimizedCharts';
import type { LineBarChartData, PieChartDatum } from './OptimizedChart';

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const generateChartColors = (count: number, opacity: number = 1): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const baseColor = CHART_COLORS[i % CHART_COLORS.length];
    colors.push(hexToRgba(baseColor, opacity));
  }
  return colors;
};

export const formatChartNumber = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
};

export const chartDataTransformers = {
  transformTimeSeries: (data: Array<{ date: Date; value: number }>, seriesName: string): LineBarChartData => {
    const key = 'value';
    return {
      xKey: 'label',
      data: data.map(point => ({
        label: point.date.toLocaleDateString(),
        [key]: point.value
      })),
      datasets: [
        {
          key,
          name: seriesName,
          color: '#3b82f6',
          type: 'monotone',
          strokeWidth: 2
        }
      ]
    };
  },
  transformCategories: (data: Record<string, number>, seriesName: string): LineBarChartData => {
    const entries = Object.entries(data);
    const key = 'value';
    return {
      xKey: 'category',
      data: entries.map(([category, value]) => ({
        category,
        [key]: value
      })),
      datasets: [
        {
          key,
          name: seriesName,
          color: '#3b82f6',
          type: 'linear'
        }
      ]
    };
  },
  transformPieData: (data: Record<string, number>): PieChartDatum[] => {
    const entries = Object.entries(data);
    return entries.map(([name, value], index) => ({
      name,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }
};
