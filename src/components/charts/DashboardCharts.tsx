/**
 * Dashboard chart components, built on recharts.
 *
 * Replaces the former ChartJsCharts adapter — the app standardises on a
 * single charting library (recharts, 16 importers) so chart.js no longer
 * ships in the bundle. Also fixes the adapter bug where the x-axis labels
 * and bar values read from the same dataKey.
 */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { formatDecimal } from '../../utils/decimal-format';

export { ResponsiveContainer };

const defaultTickFormatter = (value: number): string => {
  if (value >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)}M`;
  if (value >= 1_000) return `${formatDecimal(value / 1_000, 0)}K`;
  return formatDecimal(value, value >= 10 ? 0 : 2);
};

/**
 * Build a complete text alternative of a chart's data for screen readers.
 *
 * Recharts 3.x already provides keyboard navigation of data points
 * (accessibilityLayer), but no static summary of the numbers. We render the
 * chart as role="img" with this label so a screen reader announces every
 * value, not just a vague title. (A sibling data <table> isn't possible here:
 * each chart is the single child of a caller-side ResponsiveContainer.)
 */
const buildChartSummary = (
  title: string | undefined,
  points: Array<{ label: string; value: string }>
): string => {
  const prefix = title ? `${title}. ` : '';
  if (points.length === 0) {
    return `${prefix}No data`.trim();
  }
  const body = points.map((p) => `${p.label}: ${p.value}`).join('; ');
  return `${prefix}${body}`;
};

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  /** Key holding the bar value (e.g. 'netWorth'). */
  dataKey: string;
  /** Key holding the x-axis label. Defaults to 'month'. */
  xKey?: string;
  fill?: string;
  label?: string;
  formatter?: (value: number) => string;
  tickFormatter?: (value: number) => string;
  contentStyle?: React.CSSProperties;
  showGrid?: boolean;
  'aria-label'?: string;
}

export function BarChart({
  data,
  dataKey,
  xKey = 'month',
  fill = '#8B5CF6',
  label = 'Value',
  formatter,
  tickFormatter,
  contentStyle,
  showGrid = true,
  'aria-label': ariaLabel
}: BarChartProps): React.JSX.Element {
  const formatValue = formatter ?? defaultTickFormatter;
  const summary = buildChartSummary(
    ariaLabel,
    data.map((row) => ({
      label: String(row[xKey] ?? ''),
      value: formatValue(Number(row[dataKey] ?? 0))
    }))
  );
  return (
    <RechartsBarChart data={data} role="img" aria-label={summary}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(55, 65, 81, 0.3)" />}
      <XAxis dataKey={xKey} tick={{ fill: '#6B7280', fontSize: 12 }} />
      <YAxis
        tick={{ fill: '#6B7280', fontSize: 12 }}
        tickFormatter={tickFormatter ?? defaultTickFormatter}
      />
      <Tooltip
        contentStyle={contentStyle}
        formatter={(value: number | string | Array<number | string>) => {
          const numeric = typeof value === 'number' ? value : Number(value);
          return [formatter ? formatter(numeric) : String(value), label];
        }}
      />
      <Bar dataKey={dataKey} name={label} fill={fill} radius={[4, 4, 0, 0]} />
    </RechartsBarChart>
  );
}

export interface PieDatum {
  name: string;
  value: number;
}

interface PieChartProps<T extends PieDatum> {
  data: T[];
  colors?: string[];
  /** Render as a doughnut when true. */
  innerRadius?: boolean;
  onClick?: (datum: T) => void;
  formatter?: (value: number) => string;
  contentStyle?: React.CSSProperties;
  'aria-label'?: string;
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function PieChart<T extends PieDatum>({
  data,
  colors = DEFAULT_COLORS,
  innerRadius = false,
  onClick,
  formatter,
  contentStyle,
  'aria-label': ariaLabel
}: PieChartProps<T>): React.JSX.Element {
  // Recharts wants index-signature rows; keep the original datum reachable by
  // index so onClick hands back the caller's own object, not a copy.
  const chartData = data.map((d, index) => ({ name: d.name, value: d.value, index }));

  const formatValue = formatter ?? ((value: number) => formatDecimal(value, 2));
  const summary = buildChartSummary(
    ariaLabel,
    data.map((d) => ({ label: d.name, value: formatValue(d.value) }))
  );

  return (
    <RechartsPieChart role="img" aria-label={summary}>
      <Pie
        data={chartData}
        dataKey="value"
        nameKey="name"
        innerRadius={innerRadius ? '60%' : 0}
        outerRadius="90%"
        strokeWidth={0}
        onClick={onClick ? (entry) => {
          const payload = entry?.payload as { index?: number } | undefined;
          if (payload && typeof payload.index === 'number' && data[payload.index]) {
            onClick(data[payload.index]);
          }
        } : undefined}
        cursor={onClick ? 'pointer' : undefined}
      >
        {chartData.map((entry) => (
          <Cell key={entry.name} fill={colors[entry.index % colors.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={contentStyle}
        formatter={(value: number | string | Array<number | string>) => {
          const numeric = typeof value === 'number' ? value : Number(value);
          return formatter ? formatter(numeric) : formatDecimal(numeric, 2);
        }}
      />
    </RechartsPieChart>
  );
}
