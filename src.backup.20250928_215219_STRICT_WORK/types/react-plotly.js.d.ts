declare module 'react-plotly.js' {
  import { Component } from 'react';

  export interface PlotlyHTMLElement extends HTMLDivElement {
    on: (event: string, callback: (data: any) => void) => void;
    removeAllListeners: (event?: string) => void;
  }

  export interface Data {
    x?: any[];
    y?: any[];
    z?: any[];
    type?: string;
    mode?: string;
    name?: string;
    marker?: any;
    line?: any;
    text?: any;
    textposition?: string;
    hovertemplate?: string;
    hoverinfo?: string;
    [key: string]: any;
  }

  export interface Layout {
    title?: string | { text: string };
    xaxis?: any;
    yaxis?: any;
    showlegend?: boolean;
    legend?: any;
    margin?: any;
    paper_bgcolor?: string;
    plot_bgcolor?: string;
    font?: any;
    height?: number;
    width?: number;
    autosize?: boolean;
    [key: string]: any;
  }

  export interface Config {
    displayModeBar?: boolean;
    modeBarButtonsToRemove?: string[];
    displaylogo?: boolean;
    responsive?: boolean;
    [key: string]: any;
  }

  export interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: any[];
    revision?: number;
    onInitialized?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onPurge?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onError?: (err: any) => void;
    debug?: boolean;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
    divId?: string;
  }

  export default class Plot extends Component<PlotParams> {}
}