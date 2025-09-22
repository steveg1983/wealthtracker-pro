import React, { memo } from 'react';
import { DynamicAreaChart } from './ChartMigration';

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
      <DynamicAreaChart
          data={data}
          xDataKey="label"
          yDataKeys={['value']}
          height={200}
        />
    </div>
  );
});

export default RechartsArea;

