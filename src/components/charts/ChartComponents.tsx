// Isolated module for recharts child components
// This file is lazy-loaded separately to keep recharts out of the main bundle

import * as RechartsComponents from 'recharts';

export {
  ResponsiveContainer,
  Tooltip,
  Cell,
  Pie,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadialBar,
  Scatter,
  ZAxis,
  ErrorBar,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Brush,
  LabelList
} from 'recharts';

// Export color constants commonly used with charts
export const CHART_COLORS = [
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
];
// Default export for dynamic imports
export default RechartsComponents;
