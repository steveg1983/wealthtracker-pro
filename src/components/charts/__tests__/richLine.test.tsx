/**
 * The shared line idiom, held to what it claims.
 *
 * Three of these measure the REAL recharts in this repo rather than an
 * expectation of it, the same way `singlePointDots.test.tsx` does and for the
 * same reason: the module's central claim — that a literal `<defs>` reaches
 * the SVG while a component in that position would not — is a fact about the
 * library, and a fact about a library is worth nothing asserted from memory.
 *
 * The last group measures COLOUR, on BOTH GROUNDS. `chartColors.ts` records
 * every series contrast figure against a chart's card; a wash puts a series on
 * a different ground than the one those figures describe, so this file
 * re-measures each stroke over its own wash — at that ground's own wash
 * strength — and holds it to WCAG 1.4.11's 3:1 for a graphical object. If
 * either constant is ever raised, or a series colour with less headroom than
 * #6b86b3 is added to a ramp, this is what says so, naming the colour and the
 * ground it failed on.
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
  washTopOpacity,
} from '../richLine';
import { CATEGORICAL_AXIS, SEMANTIC_SERIES, categoricalRamp, decompositionSeries } from '../chartColors';
import { ColorContrastChecker } from '../../../utils/color-contrast-checker';

const COLOUR = '#2d3a4d';
const ON_LIGHT = false;
const ON_DARK = true;
const ONE_MONTH = [{ label: 'Aug 2026', value: 1200 }];
const THREE_MONTHS = [
  { label: 'Jun 2026', value: 900 },
  { label: 'Jul 2026', value: 1050 },
  { label: 'Aug 2026', value: 1200 },
];

/** Draws a washed series and reports what recharts actually put in the DOM. */
function draw(data: typeof THREE_MONTHS, chartKey: string, colour: string, isDark = ON_LIGHT) {
  const { container } = render(
    <AreaChart width={600} height={300} data={data}>
      {seriesWash(chartKey, colour, isDark)}
      <XAxis dataKey="label" />
      <YAxis />
      <Area
        type="monotone"
        dataKey="value"
        stroke={colour}
        strokeWidth={2}
        fill={seriesWashFill(chartKey, colour, isDark)}
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
  it('is the same id for the same chart, colour and ground, every call', () => {
    expect(seriesWashId('net-worth-report', COLOUR, ON_LIGHT))
      .toBe(seriesWashId('net-worth-report', COLOUR, ON_LIGHT));
  });

  it('separates two colours in one chart, and two charts sharing a colour', () => {
    const ids = new Set([
      seriesWashId('net-worth-report', '#2d3a4d', ON_LIGHT),
      seriesWashId('net-worth-report', '#94a3b8', ON_LIGHT),
      seriesWashId('investments-performance', '#2d3a4d', ON_LIGHT),
      seriesWashId('investments-performance', '#94a3b8', ON_LIGHT),
    ]);
    expect(ids.size).toBe(4);
  });

  it('THE STALE-GRADIENT TRAP: one colour on two grounds is two ids', () => {
    // The custom report builder can store a `borderColor` with a dataset, so a
    // stroke that does NOT move with the theme is reachable. If the id ignored
    // the ground, that chart would ask for the same id after dusk, find the
    // light gradient already in the document and keep the weaker wash.
    expect(seriesWashId('custom-report', COLOUR, ON_LIGHT))
      .not.toBe(seriesWashId('custom-report', COLOUR, ON_DARK));
  });

  it('normalises the colour, so one hue cannot own two ids', () => {
    expect(seriesWashId('a', '#2D3A4D', ON_LIGHT)).toBe(seriesWashId('a', '#2d3a4d', ON_LIGHT));
  });

  it('makes an SVG name out of whatever the caller wrote', () => {
    // The custom report viewer builds its key from a component id, and the
    // builder has seeded those empty and can seed them with anything. The
    // opacity in the id carries a decimal point, which is not an SVG name
    // character either.
    const id = seriesWashId('custom-report-component (1)/2', COLOUR, ON_DARK);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(seriesWashId('', COLOUR, ON_LIGHT)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('the fill points at the id, on either ground', () => {
    expect(seriesWashFill('x', COLOUR, ON_LIGHT)).toBe(`url(#${seriesWashId('x', COLOUR, ON_LIGHT)})`);
    expect(seriesWashFill('x', COLOUR, ON_DARK)).toBe(`url(#${seriesWashId('x', COLOUR, ON_DARK)})`);
  });
});

describe('what recharts actually renders', () => {
  it('THE CLAIM: a literal <defs> reaches the SVG and the fill resolves to it', () => {
    for (const isDark of [ON_LIGHT, ON_DARK]) {
      const drawn = draw(THREE_MONTHS, 'measured', COLOUR, isDark);
      expect(drawn.fill).toBe(seriesWashFill('measured', COLOUR, isDark));
      expect(drawn.fillResolves).toBe(true);
    }
  });

  it('the gradient is the series own colour at its GROUND strength, fading to nothing', () => {
    for (const isDark of [ON_LIGHT, ON_DARK]) {
      const drawn = draw(THREE_MONTHS, 'measured', COLOUR, isDark);
      expect(drawn.stops).toEqual([
        { colour: COLOUR, opacity: String(washTopOpacity(isDark)) },
        { colour: COLOUR, opacity: String(WASH_BOTTOM_OPACITY) },
      ]);
    }
  });

  it("THE OWNER'S 29 AUG NOTE: the dark wash carries more ink than the light one", () => {
    const [lightTop] = draw(THREE_MONTHS, 'measured', COLOUR, ON_LIGHT).stops;
    const [darkTop] = draw(THREE_MONTHS, 'measured', COLOUR, ON_DARK).stops;
    expect(Number(darkTop?.opacity)).toBeGreaterThan(Number(lightTop?.opacity));
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
  const groundOf = (isDark: boolean): string => (isDark ? CARD.dark : CARD.light);
  const nameOf = (isDark: boolean): string => (isDark ? 'dark' : 'light');

  const composite = (colour: string, ground: string, alpha: number): string => {
    const fg = ColorContrastChecker.hexToRgb(colour);
    const bg = ColorContrastChecker.hexToRgb(ground);
    return ColorContrastChecker.rgbToHex({
      r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
      g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
      b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
    });
  };

  /** A stroke read against a tint of ITSELF over its card. */
  const overOwnWash = (colour: string, isDark: boolean, alpha = washTopOpacity(isDark)): number =>
    ColorContrastChecker.getContrastRatio(colour, composite(colour, groundOf(isDark), alpha));

  /** Every colour a washed series can be drawn in, on one ground. */
  const washableColours = (isDark: boolean): readonly string[] => {
    const series = decompositionSeries(isDark);
    return [
      ...categoricalRamp(isDark),
      series.total.color,
      series.part.color,
      series.counterpart.color,
    ];
  };

  it('every series colour survives its own wash, on the ground it is drawn on', () => {
    // Collected rather than asserted one at a time, so a failure names the
    // colour AND the ground rather than stopping at the first.
    const failures = washableColours(ON_LIGHT)
      .map(colour => [colour, ON_LIGHT] as const)
      .concat(washableColours(ON_DARK).map(colour => [colour, ON_DARK] as const))
      .map(([colour, isDark]) => ({ colour, isDark, ratio: overOwnWash(colour, isDark) }))
      .filter(({ ratio }) => ratio < AA_GRAPHICS)
      .map(({ colour, isDark, ratio }) =>
        `${colour} on ${nameOf(isDark)} at ${washTopOpacity(isDark)}: ${ratio.toFixed(2)}:1`);

    expect(failures).toEqual([]);
  });

  it('names the step that sets BOTH ceilings, so a raise fails with its reason', () => {
    // #6b86b3 is the one axis step legible on both grounds (chartColors), so
    // it is the lowest-contrast step of BOTH ramps — and it is deliberately
    // there, being where a capped series puts its folded remainder. It has the
    // least headroom of anything the app draws, so it fixes both constants:
    // light 0.14 → 3.03 (0.15 lands on 3.00, 0.18 fails at 2.90),
    // dark  0.20 → 3.03 (0.205 lands on 3.02, 0.22 fails at 2.97).
    // If it ever stops being the weakest colour, re-derive both.
    for (const isDark of [ON_LIGHT, ON_DARK]) {
      const ground = groundOf(isDark);
      const weakest = categoricalRamp(isDark).reduce((worst, colour) =>
        ColorContrastChecker.getContrastRatio(colour, ground)
          < ColorContrastChecker.getContrastRatio(worst, ground) ? colour : worst
      );
      expect(weakest).toBe('#6b86b3');
      expect(CATEGORICAL_AXIS).toContain(weakest);
      expect(overOwnWash(weakest, isDark)).toBeGreaterThanOrEqual(AA_GRAPHICS);
    }
    // …and the strength each ground rules out.
    expect(overOwnWash('#6b86b3', ON_LIGHT, 0.18)).toBeLessThan(AA_GRAPHICS);
    expect(overOwnWash('#6b86b3', ON_DARK, 0.22)).toBeLessThan(AA_GRAPHICS);
  });

  it('the dark ground has more headroom than the light one, which is why it has its own number', () => {
    expect(WASH_TOP_OPACITY.dark).toBeGreaterThan(WASH_TOP_OPACITY.light);
    // The same colour on both grounds: it is nearer the bar on light (3.51:1
    // bare) than on dark (3.97:1), and that difference IS the extra strength.
    expect(ColorContrastChecker.getContrastRatio('#6b86b3', CARD.dark))
      .toBeGreaterThan(ColorContrastChecker.getContrastRatio('#6b86b3', CARD.light));
  });

  it('the semantic pair could not carry a dark wash even if the rule allowed one', () => {
    // Recorded because it is the second reason the income/expense charts take
    // part 1 of the idiom and stop: expense red is 3.36:1 bare on a dark card,
    // so the LIGHT constant already spends it down to 3.01 — over the bar by a
    // hundredth — and the dark one puts it under at 2.82.
    expect(overOwnWash(SEMANTIC_SERIES.expense, ON_DARK, WASH_TOP_OPACITY.light))
      .toBeLessThan(3.05);
    expect(overOwnWash(SEMANTIC_SERIES.expense, ON_DARK)).toBeLessThan(AA_GRAPHICS);
  });

  it('the wash is a wash: it never approaches an opaque fill', () => {
    expect(WASH_TOP_OPACITY.light).toBeLessThan(0.25);
    expect(WASH_TOP_OPACITY.dark).toBeLessThan(0.25);
    expect(WASH_BOTTOM_OPACITY).toBe(0);
  });
});
