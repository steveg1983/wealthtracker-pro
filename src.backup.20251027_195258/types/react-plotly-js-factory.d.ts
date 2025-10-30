declare module 'react-plotly.js/factory' {
  import type { ComponentType, CSSProperties } from 'react';

  type PlotlyLayout = Record<string, unknown>;
  type PlotlyConfig = Record<string, unknown>;
  type PlotlyData = Record<string, unknown>;

  export interface PlotComponentProps {
    data?: PlotlyData[];
    layout?: Partial<PlotlyLayout>;
    config?: Partial<PlotlyConfig>;
    frames?: unknown[];
    revision?: number;
    style?: CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    divId?: string;
    onInitialized?: (figure: { data: PlotlyData[]; layout: Partial<PlotlyLayout>; frames?: unknown[] }) => void;
    onUpdate?: (figure: { data: PlotlyData[]; layout: Partial<PlotlyLayout>; frames?: unknown[] }) => void;
    [key: string]: unknown;
  }

  const createPlotComponent: (plotly: unknown) => ComponentType<PlotComponentProps>;

  export default createPlotComponent;
}
