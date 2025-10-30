type PlotlyModule = {
  readonly moduleType?: string;
  readonly name?: string;
  readonly categories?: ReadonlyArray<string>;
  [key: string]: unknown;
};

type PlotlyCore = {
  register: (modules: readonly PlotlyModule[] | PlotlyModule) => void;
};

declare module 'plotly.js/lib/core' {
  const Plotly: PlotlyCore;
  export default Plotly;
}

declare module 'plotly.js/lib/bar' {
  const bar: PlotlyModule;
  export default bar;
}

declare module 'plotly.js/lib/box' {
  const box: PlotlyModule;
  export default box;
}

declare module 'plotly.js/lib/candlestick' {
  const candlestick: PlotlyModule;
  export default candlestick;
}

declare module 'plotly.js/lib/funnel' {
  const funnel: PlotlyModule;
  export default funnel;
}

declare module 'plotly.js/lib/indicator' {
  const indicator: PlotlyModule;
  export default indicator;
}

declare module 'plotly.js/lib/heatmap' {
  const heatmap: PlotlyModule;
  export default heatmap;
}

declare module 'plotly.js/lib/pie' {
  const pie: PlotlyModule;
  export default pie;
}

declare module 'plotly.js/lib/sankey' {
  const sankey: PlotlyModule;
  export default sankey;
}

declare module 'plotly.js/lib/scatter' {
  const scatter: PlotlyModule;
  export default scatter;
}

declare module 'plotly.js/lib/scatterpolar' {
  const scatterpolar: PlotlyModule;
  export default scatterpolar;
}

declare module 'plotly.js/lib/sunburst' {
  const sunburst: PlotlyModule;
  export default sunburst;
}

declare module 'plotly.js/lib/treemap' {
  const treemap: PlotlyModule;
  export default treemap;
}

declare module 'plotly.js/lib/violin' {
  const violin: PlotlyModule;
  export default violin;
}

declare module 'plotly.js/lib/waterfall' {
  const waterfall: PlotlyModule;
  export default waterfall;
}
