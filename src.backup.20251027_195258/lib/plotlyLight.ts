// Lightweight Plotly bundle registering only the traces used in ChartWizard
import Plotly from 'plotly.js/lib/core';

import bar from 'plotly.js/lib/bar';
import box from 'plotly.js/lib/box';
import candlestick from 'plotly.js/lib/candlestick';
import funnel from 'plotly.js/lib/funnel';
import gauge from 'plotly.js/lib/indicator';
import heatmap from 'plotly.js/lib/heatmap';
import pie from 'plotly.js/lib/pie';
import sankey from 'plotly.js/lib/sankey';
import scatter from 'plotly.js/lib/scatter';
import scatterpolar from 'plotly.js/lib/scatterpolar';
import sunburst from 'plotly.js/lib/sunburst';
import treemap from 'plotly.js/lib/treemap';
import violin from 'plotly.js/lib/violin';
import waterfall from 'plotly.js/lib/waterfall';

Plotly.register([
  bar,
  box,
  candlestick,
  funnel,
  gauge,
  heatmap,
  pie,
  sankey,
  scatter,
  scatterpolar,
  sunburst,
  treemap,
  violin,
  waterfall
]);

export default Plotly;
