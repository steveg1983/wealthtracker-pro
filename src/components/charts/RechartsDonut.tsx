import React, { memo, useMemo } from 'react';
import { DynamicPieChart } from './ChartMigration';

interface RechartsDonutProps {
  labels: string[];
  values: number[];
  colors: string[];
  height?: number;
  className?: string;
  innerRadiusPercent?: number; // e.g., 60 for 60%
  valueFormatter?: (value: number) => string;
}

const RechartsDonut: React.FC<RechartsDonutProps> = memo(function RechartsDonut({
  labels,
  values,
  colors,
  height = 128,
  className,
  innerRadiusPercent = 60,
  valueFormatter,
}) {
  const data = useMemo(() => labels.map((name, i) => ({ name, value: values[i] ?? 0, color: colors[i % colors.length] })), [labels, values, colors]);
  const total = useMemo(() => values.reduce((s, v) => s + (v || 0), 0), [values]);

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload as { name: string; value: number };
    const percent = total > 0 ? (p.value / total) * 100 : 0;
    const value = valueFormatter ? valueFormatter(p.value) : String(p.value);
    return (
      <div className="rounded bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow">
        <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
        <div className="text-gray-600 dark:text-gray-300">{value} ({percent.toFixed(1)}%)</div>
      </div>
    );
  };

  return (
    <div className={className} style={{ height }}>
      <DynamicPieChart
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadiusPercent}
          height={height}
          customTooltip={renderTooltip}
        />
    </div>
  );
});

export default RechartsDonut;

