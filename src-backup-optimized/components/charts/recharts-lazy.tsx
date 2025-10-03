/**
 * Lazy-loaded Recharts components
 * This module provides all Recharts components as lazy-loaded versions
 * to prevent them from being included in the main bundle
 */

import { lazy } from 'react';

// Create a lazy component that loads Recharts
const RechartsModule = lazy(() => import('recharts'));

// Export a function to dynamically import Recharts components
export async function loadRecharts() {
  return import('recharts');
}

// Helper to create lazy chart components
export function createLazyChartComponent<T extends keyof typeof import('recharts')>(
  componentName: T
) {
  return lazy(async () => {
    const module = await import('recharts');
    return { default: module[componentName] as any };
  });
}

// Export lazy versions of commonly used Recharts components
export const PieChart = createLazyChartComponent('PieChart');
export const BarChart = createLazyChartComponent('BarChart');
export const LineChart = createLazyChartComponent('LineChart');
export const AreaChart = createLazyChartComponent('AreaChart');
export const Treemap = createLazyChartComponent('Treemap');
export const RadarChart = createLazyChartComponent('RadarChart');
export const ScatterChart = createLazyChartComponent('ScatterChart');
export const ComposedChart = createLazyChartComponent('ComposedChart');

// These components are lightweight and can be exported directly
// They don't render anything by themselves
export const ResponsiveContainer = createLazyChartComponent('ResponsiveContainer');
export const Tooltip = createLazyChartComponent('Tooltip');
export const Legend = createLazyChartComponent('Legend');
export const Cell = createLazyChartComponent('Cell');

// Chart child components
export const Pie = createLazyChartComponent('Pie');
export const Bar = createLazyChartComponent('Bar');
export const Line = createLazyChartComponent('Line');
export const Area = createLazyChartComponent('Area');
export const Scatter = createLazyChartComponent('Scatter');
export const Radar = createLazyChartComponent('Radar');
export const RadialBar = createLazyChartComponent('RadialBar');
export const Brush = createLazyChartComponent('Brush');

// Axis components
export const XAxis = createLazyChartComponent('XAxis');
export const YAxis = createLazyChartComponent('YAxis');
export const ZAxis = createLazyChartComponent('ZAxis');
export const CartesianGrid = createLazyChartComponent('CartesianGrid');
export const PolarGrid = createLazyChartComponent('PolarGrid');
export const PolarRadiusAxis = createLazyChartComponent('PolarRadiusAxis');
export const PolarAngleAxis = createLazyChartComponent('PolarAngleAxis');

// Reference components
export const ReferenceLine = createLazyChartComponent('ReferenceLine');
export const ReferenceArea = createLazyChartComponent('ReferenceArea');
export const ReferenceDot = createLazyChartComponent('ReferenceDot');

// Error Bar
export const ErrorBar = createLazyChartComponent('ErrorBar');

// Label components
export const Label = createLazyChartComponent('Label');
export const LabelList = createLazyChartComponent('LabelList');

// Export default module for cases where all components are needed
export default RechartsModule;