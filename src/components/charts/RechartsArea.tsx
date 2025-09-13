import React, { memo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface RechartsAreaProps {
  labels: string[];
  values: number[];
  stroke: string; // line color e.g. 'rgb(34, 197, 94)'
  fill: string;   // area color e.g. 'rgba(34, 197, 94, 0.1)'
  height?: number;
  compact?: boolean; // hides axes for compact widgets
  className?: string;
  yFormatter?: (value: number) => string;
}

const RechartsArea: React.FC<RechartsAreaProps> = memo(function RechartsArea({
  labels,
  values,
  stroke,
  fill,
  height = 160,
  compact = false,
  className,
  yFormatter,
}) {
  // Build data array from labels/values
  const data = labels.map((label, i) => ({ label, value: values[i] ?? 0 }));

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          {!compact && (
            <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
          )}
          <XAxis dataKey="label" hide={compact} tickLine={false} axisLine={false} />
          <YAxis
            hide={compact}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormatter}
          />
          <Tooltip
            formatter={(value: number) => (yFormatter ? yFormatter(value) : String(value))}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={fill}
            strokeWidth={2}
            activeDot={{ r: compact ? 2 : 4 }}
            dot={compact ? false : { r: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default RechartsArea;

