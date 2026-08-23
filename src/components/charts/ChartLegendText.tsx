import React from 'react';
import type { LegendProps } from 'recharts';

/**
 * Legend label text in the page's own text colour.
 *
 * Recharts' default legend colours each LABEL with its series colour — the
 * same promotion of a graphics colour to text that the tooltips had (see
 * useChartTooltipItemStyle). On the spending donut it read as "two labels in
 * a lighter blue than the other six", which a reader parses as links or as
 * emphasis; on light ground the ramp's lightest step is barely legible as
 * words at all. The swatch is the graphic and keeps the series colour — the
 * words identify, and identification is body text.
 *
 * Passed to recharts as `<Legend formatter={legendText} />`.
 * tooltipItemLegibility.test.ts holds every <Legend to this (formatter or
 * a fully custom `content`, which draws its own neutral text).
 */
export const legendText: NonNullable<LegendProps['formatter']> = (value) => (
  <span className="text-xs text-gray-600 dark:text-gray-300">{String(value)}</span>
);
