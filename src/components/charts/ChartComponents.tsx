// Isolated module for recharts child components
// This file is lazy-loaded separately to keep recharts out of the main bundle

import {
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
import { CHART_COLORS } from './chartColors';

// Re-export for named imports
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
};

// Export color constants commonly used with charts
// Default export for lazy loading - re-exports all named exports
const ChartComponents = {
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
  LabelList,
  CHART_COLORS
};

export default ChartComponents;
