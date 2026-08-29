/**
 * The shared line idiom, held to what it claims.
 *
 * Three of these measure the REAL recharts in this repo rather than an
 * expectation of it, the same way `singlePointDots.test.tsx` does and for the
 * same reason: the module's central claim — that a literal `<defs>` reaches
 * the SVG while a component in that position would not — is a fact about the
 * library, and a fact about a library is worth nothing asserted from memory.
 *
 * The last one measures COLOUR. `chartColors.ts` records every series contrast
 * figure against a chart's card; a wash puts a series on a different ground
 * than the one those figures describe, so this file re-measures the stroke over
 * its own wash and holds it to WCAG 1.4.11's 3:1 for a graphical object. If the
 * wash is ever strengthened, this is what says how far it may go.
 *
 * No ResponsiveContainer: it measures the DOM and jsdom lays nothing out, so
 * the charts get explicit dimensions. Every figure is invented — this repo is
 * public.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import {
  HOVER_MARKER_RADIUS,
  WASH_BOTTOM_OPACITY,
  WASH_TOP_OPACITY,
  hoverMarker,
  lineMarkers,
  seriesWash,
  seriesWashFill,
  seriesWashId,
} from '../richLine';
import { CATEGORICAL_AXIS, categoricalRamp, decompositionSeries } from '../chartColors';
import { ColorContrastChecker } from '../../../utils/color-contrast-checker';

const COLOUR = '#2d3a4d';
const ONE_MONTH = [{ label: 'Aug 2026', value: 1200 }];
const THREE_MONTHS = [
  { label: 'Jun 2026', value: 900 },
  { label: 'Jul 2026', value: 1050 },
  { label: 'Aug 2026', value: 1200 },
];

/** Draws a washed series and reports what recharts actually put in the DOM. */
function draw(data: typeof THREE_MONTHS, chartKey: string, colour: string) {
  const { container } = render(
    <AreaChart width={600} height={300} data={data}>
      {seriesWash(chartKey, colour)}
      <XAxis dataKey="label" />
      <YAxis />
      <Area
        type="monotone"
        dataKey="value"
        stroke={colour}
        strokeWidth={2}
        fill={seriesWashFill(chartKey, colour)}
        fillOpacity={1}
        {...lineMarkers(data, colour)}
        isAnimationActive={false}
      />
    </AreaChart>
  );
  const area = container.querySelector('.recharts-area-area');
  const fill = area?.getAttribute('fill') ?? '';
  const referenced = fill.replace(/^url\(#/, '').replace(/\)$/, '');
  return {
    container,
    fill,
    /** True when the fill points at a gradient that exists in this document. */
    fillResolves: referenced !== '' && container.querySelector(`#${referenced}`) !== null,
    curves: container.querySelectorAll('.recharts-area-curve').length,
    dots: container.querySelectorAll('.recharts-area-dot').length,
    stops: Array.from(container.querySelectorAll('linearGradient stop')).map(stop => ({
      colour: stop.getAttribute('stop-color'),
      opacity: stop.getAttribute('stop-opacity'),
    })),
  };
}

describe('the wash id is derived, never random', () => {
  it('is the same id for the same chart and colour, every call', () => {
    expect(seriesWashId('net-worth-report', COLOUR)).toBe(seriesWashId('net-worth-report', COLOUR));
  });

  it('separates two colours in one chart, and two charts sharing a colour', () => {
    const ids = new Set([
      seriesWashId('net-worth-report', '#2d3a4d'),
      seriesWashId('net-worth-report', '#94a3b8'),
      seriesWashId('investments-performance', '#2d3a4d'),
      seriesWashId('investments-performance', '#94a3b8'),
    ]);
    expect(ids.size).toBe(4);
  });

  it('normalises the colour, so one hue cannot own two ids', () => {
    expect(seriesWashId('a', '#2D3A4D')).toBe(seriesWashId('a', '#2d3a4d'));
  });

  it('makes an SVG name out of whatever the caller wrote', () => {
    // The custom report viewer builds its key from a component id, and the
    // builder has seeded those empty and can seed them with anything.
    const id = seriesWashId('custom-report-component (1)/2', COLOUR);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(seriesWashId('', COLOUR)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('the fill points at the id', () => {
    expect(seriesWashFill('x', COLOUR)).toBe(`url(#${seriesWashId('x', COLOUR)})`);
  });
});

describe('what recharts actually renders', () => {
  it('THE CLAIM: a literal <defs> reaches the SVG and the fill resolves to it', () => {
    const drawn = draw(THREE_MONTHS, 'measured', COLOUR);
    expect(drawn.fill).toBe(seriesWashFill('measured', COLOUR));
    expect(drawn.fillResolves).toBe(true);
  });

  it('the gradient is the series own colour, fading to nothing', () => {
    const drawn = draw(THREE_MONTHS, 'measured', COLOUR);
    expect(drawn.stops).toEqual([
      { colour: COLOUR, opacity: String(WASH_TOP_OPACITY) },
      { colour: COLOUR, opacity: String(WASH_BOTTOM_OPACITY) },
    ]);
  });

  it("THE OWNER'S BUG: a real series draws a line and no marks at all", () => {
    const drawn = draw(THREE_MONTHS, 'measured', COLOUR);
    expect(drawn.curves).toBe(1);
    expect(drawn.dots).toBe(0);
  });

  it('a window holding ONE point still draws its solid mark', () => {
    // Delegated to singlePointDots, which measured why the boolean is inert.
    // Washing a series must not quietly take that exception away.
    const drawn = draw(ONE_MONTH, 'measured', COLOUR);
    expect(drawn.dots).toBe(1);
    const dot = drawn.container.querySelector('.recharts-area-dot');
    expect(dot?.getAttribute('fill')).toBe(COLOUR);
    expect(dot?.getAttribute('r')).toBe('4');
  });
});

describe('the marks a series asks for', () => {
  it('no dots on a real series, a solid one on a lone point', () => {
    expect(lineMarkers(THREE_MONTHS, COLOUR).dot).toBe(false);
    expect(lineMarkers(ONE_MONTH, COLOUR).dot).toEqual({ r: 4, fill: COLOUR, strokeWidth: 0 });
  });

  it('the hover mark is solid ink in the series own colour', () => {
    expect(hoverMarker(COLOUR)).toEqual({ r: HOVER_MARKER_RADIUS, fill: COLOUR, strokeWidth: 2 });
    expect(lineMarkers(THREE_MONTHS, COLOUR).activeDot).toEqual(hoverMarker(COLOUR));
  });
});

/**
 * A wash changes the ground its own line is drawn on, and every contrast
 * figure in `chartColors.ts` is taken against the bare card. So the ground a
 * washed series is actually measured against is the wash composited over the
 * card, at its strongest — the top of the gradient, immediately under the line.
 */
describe('a line still clears the graphics bar over its own wash', () => {
  const AA_GRAPHICS = 3.0;
  /** The dimmest chart surface each ground uses, as chartColors measures it. */
  const CARD = { light: '#f8f9fb', dark: '#1f2937' } as const;

  const composite = (colour: string, ground: string, alpha: number): string => {
    const fg = ColorContrastChecker.hexToRgb(colour);
    const bg = ColorContrastChecker.hexToRgb(ground);
    return ColorContrastChecker.rgbToHex({
      r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
      g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
      b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
    });
  };

  it('every ramp step survives being washed with itself, on both grounds', () => {
    for (const dark of [false, true]) {
      const ground = dark ? CARD.dark : CARD.light;
      for (const colour of categoricalRamp(dark)) {
        const washed = composite(colour, ground, WASH_TOP_OPACITY);
        expect(ColorContrastChecker.getContrastRatio(colour, washed))
          .toBeGreaterThanOrEqual(AA_GRAPHICS);
      }
    }
  });

  it('the net worth line survives its own wash, on both grounds', () => {
    for (const dark of [false, true]) {
      const ground = dark ? CARD.dark : CARD.light;
      const { color } = decompositionSeries(dark).total;
      const washed = composite(color, ground, WASH_TOP_OPACITY);
      expect(ColorContrastChecker.getContrastRatio(color, washed))
        .toBeGreaterThanOrEqual(AA_GRAPHICS);
    }
  });

  it('names the step that sets the ceiling, so a raise fails with its reason', () => {
    // #6b86b3 is the ramp's lightest step on light — the one chartColors
    // chooses precisely because it RECEDES, at 3.51:1 bare. It has the least
    // headroom of anything the app draws, so it is what fixes
    // WASH_TOP_OPACITY: 0.15 lands exactly on 3.00 and 0.18 fails at 2.90.
    // If this ever stops being the weakest colour, re-derive the constant.
    const weakest = categoricalRamp(false).reduce((worst, colour) =>
      ColorContrastChecker.getContrastRatio(colour, CARD.light)
        < ColorContrastChecker.getContrastRatio(worst, CARD.light) ? colour : worst
    );
    expect(weakest).toBe('#6b86b3');
    expect(CATEGORICAL_AXIS).toContain(weakest);

    const washed = composite(weakest, CARD.light, WASH_TOP_OPACITY);
    expect(ColorContrastChecker.getContrastRatio(weakest, washed))
      .toBeGreaterThanOrEqual(AA_GRAPHICS);
    // …and the strength it rules out.
    expect(ColorContrastChecker.getContrastRatio(weakest, composite(weakest, CARD.light, 0.18)))
      .toBeLessThan(AA_GRAPHICS);
  });

  it('the wash is a wash: it never approaches an opaque fill', () => {
    expect(WASH_TOP_OPACITY).toBeLessThan(0.25);
    expect(WASH_BOTTOM_OPACITY).toBe(0);
  });
});
