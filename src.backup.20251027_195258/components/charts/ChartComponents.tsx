// Isolated module for recharts child components
// This file is lazy-loaded separately to keep recharts out of the main bundle

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

// Re-export chart colors for backwards compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { CHART_COLORS } from '../../constants/chartColors';