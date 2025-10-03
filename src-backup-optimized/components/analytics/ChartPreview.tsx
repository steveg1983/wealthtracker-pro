import React, { useEffect, memo, useMemo } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { DynamicPieChart, DynamicBarChart, DynamicLineChart, DynamicAreaChart, DynamicTreemap } from '../../charts/ChartMigration';

export interface PlotlyTrace {
  type?: string;
  x?: Array<string | number | Date>;
  y?: Array<string | number | Date>;
  name?: string;
  mode?: string;
  fill?: string;
  stackgroup?: string;
  orientation?: string;
  text?: string[];
  textposition?: string;
  marker?: {
    color?: string | string[];
    size?: number | number[];
    sizemode?: string;
    sizeref?: number;
    showscale?: boolean;
    symbol?: string | string[];
    opacity?: number | number[];
    line?: { width?: number; color?: string };
    [key: string]: unknown;
  };
  labels?: string[];
  values?: number[];
  hole?: number;
  parents?: string[];
  ids?: string[];
  z?: number[][];
  colorscale?: string;
  textinfo?: string;
  connector?: { line?: { color?: string } };
  [key: string]: unknown;
}

export interface PlotlyLayout {
  title?: string;
  xaxis?: {
    title?: string;
    showgrid?: boolean;
    type?: string;
  };
  yaxis?: {
    title?: string;
    showgrid?: boolean;
    type?: string;
  };
  barmode?: string;
  showlegend?: boolean;
  hovermode?: string;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  margin?: {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
  };
  height?: number;
  width?: number;
  font?: {
    color?: string;
  };
  [key: string]: unknown;
}

interface ChartPreviewProps {
  data: PlotlyTrace[] | null;
  layout: PlotlyLayout;
  title?: string;
  height?: number;
}

export const ChartPreview = memo(function ChartPreview({ data,
  layout,
  title,
  height = 400
 }: ChartPreviewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ChartPreview component initialized', {
      componentName: 'ChartPreview'
    });
  }, []);

  const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Detect basic chart type from traces (supports scatter/line, bar, pie)
  const primaryType = useMemo(() => {
    const t = data?.[0]?.type || 'scatter';
    if (t === 'bar') return 'bar';
    if (t === 'pie') return 'pie';
    return 'line';
  }, [data]);

  // Build a unified table for line/bar
  const labels = useMemo(() => (data && data[0] && Array.isArray(data[0].x) ? data[0].x : []), [data]) as Array<string | number | Date>;
  const table = useMemo(() => {
    if (!data) return [] as any[];
    return (labels as any[]).map((label, i) => {
      const row: any = { label };
      data.forEach((trace, idx) => {
        const key = trace.name || `series${idx + 1}`;
        const arr = Array.isArray(trace.y) ? trace.y : Array.isArray(trace.values) ? trace.values : [];
        row[key] = (arr as any[])[i] ?? 0;
      });
      return row;
    });
  }, [data, labels]);

  const seriesMeta = useMemo(() => {
    if (!data) return [] as Array<{ key: string; stroke: string; fill: string }>;
    return data.map((trace, idx) => {
      const key = trace.name || `series${idx + 1}`;
      const color = (trace.marker?.color as string) || palette[idx % palette.length];
      const fill = trace.fill ? color + '33' : 'rgba(59, 130, 246, 0.1)';
      return { key, stroke: color, fill };
    });
  }, [data, palette]);

  // Early return AFTER all hooks
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">
          No chart data available. Configure your chart to see a preview.
        </p>
      </div>
    );
  }

  const finalLayout: PlotlyLayout = {
    ...layout,
    ...(title ?? layout.title ? { title: (title ?? layout.title) as string } : {}),
    height,
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      color: '#6b7280',
      ...layout.font
    },
    margin: {
      t: 40,
      r: 20,
      b: 40,
      l: 60,
      ...layout.margin
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div style={{ height: finalLayout.height || 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          {primaryType === 'pie' ? (
            (() => {
              const labelsPie = (data?.[0]?.labels || []) as string[];
              const valuesPie = (data?.[0]?.values || []) as number[];
              const colors = (data?.[0]?.marker?.color as string[]) || labelsPie.map((_, i) => palette[i % palette.length]);
              const pieData = labelsPie.map((name, i) => ({ name, value: valuesPie[i] ?? 0, color: colors[i % colors.length] }));
              return (
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={data?.[0]?.hole ? `${data[0].hole * 100}%` : '0%'} outerRadius="100%">
                    {pieData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} stroke={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              );
            })()
          ) : primaryType === 'bar' ? (
            <BarChart data={table} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              {seriesMeta.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.fill} stroke={s.stroke} />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={table} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              {seriesMeta.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.stroke} fill={s.fill} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
});
