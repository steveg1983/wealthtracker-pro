declare module 'react-plotly.js' {
  import { Component } from 'react';
  import Plotly from 'plotly.js';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    onInitialized?: (figure: Readonly<PlotParams>, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Readonly<PlotParams>, graphDiv: HTMLElement) => void;
    onPurge?: (figure: Readonly<PlotParams>, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    divId?: string;
    className?: string;
    style?: React.CSSProperties;
    debug?: boolean;
    useResizeHandler?: boolean;
    onAfterExport?: () => void;
    onAfterPlot?: () => void;
    onAnimated?: () => void;
    onAnimating?: () => void;
    onAnimationInterrupted?: () => void;
    onAutoSize?: () => void;
    onBeforeExport?: () => void;
    onButtonClicked?: () => void;
    onClick?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
    onClickAnnotation?: () => void;
    onDeselect?: () => void;
    onDoubleClick?: () => void;
    onFramework?: () => void;
    onHover?: (event: Readonly<Plotly.PlotHoverEvent>) => void;
    onLegendClick?: (event: Readonly<Plotly.LegendClickEvent>) => boolean | void;
    onLegendDoubleClick?: (event: Readonly<Plotly.LegendClickEvent>) => boolean | void;
    onRelayout?: (event: Readonly<Plotly.PlotRelayoutEvent>) => void;
    onRestyle?: (event: Readonly<Plotly.PlotRestyleEvent>) => void;
    onRedraw?: () => void;
    onSelected?: (event: Readonly<Plotly.PlotSelectionEvent>) => void;
    onSelecting?: () => void;
    onSliderChange?: () => void;
    onSliderEnd?: () => void;
    onSliderStart?: () => void;
    onTransitioning?: () => void;
    onTransitionInterrupted?: () => void;
    onUnhover?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
  }

  class Plot extends Component<PlotParams> {}

  export default Plot;
}