import React from 'react';
import { singlePointDot, type SinglePointDot } from './singlePointDots';

/**
 * How a time series is DRAWN, once, for every chart that draws one.
 *
 * ─ WHAT THE OWNER SAW (29 Aug, beside a competitor's screenshots) ──────────
 * "Their lines look more like what you see on an investment platform. Ours
 * just look like a load of 'dots' together to make an up and down line."
 *
 * He was looking at Investments' Portfolio Performance, and he was describing
 * a real defect rather than a taste: that chart asked for `dot={{ fill }}`, so
 * recharts drew a filled circle on EVERY point of a ~200-point series. At that
 * density the marks touch, the line disappears underneath them, and the
 * picture reads as beads on a string. The dots were carrying nothing either —
 * the click target is the CHART (recharts hands back the label under the
 * pointer), not each dot, so no dot was ever a thing to aim at.
 *
 * Four other charts had already reached the right answer independently
 * (`singlePointDot(...)`, which is `false` for anything longer than one
 * point). One had not, and there was nowhere for the rule to live, which is
 * how a fifth site would have got it wrong next. So the rule lives here.
 *
 * ─ THE IDIOM, IN THREE PARTS ───────────────────────────────────────────────
 *
 * 1. NO MARK PER POINT; ONE MARK ON HOVER. `lineMarkers` answers both `dot`
 *    and `activeDot` together, because they are one decision: the line is bare
 *    while you read it, and the point under the pointer is marked while you
 *    interrogate it. `dot` delegates to `singlePointDot` and does not
 *    reimplement it — a window holding a SINGLE point still gets its solid
 *    mark, for the measured reason that module records at length (recharts
 *    draws a lone point as a white-filled 3px ring that reads as an empty
 *    plot, and the tempting `dot={data.length === 1}` changes nothing).
 *
 * 2. A WASH UNDER THE LINE, IN THE LINE'S OWN COLOUR. A vertical gradient from
 *    the series colour at WASH_TOP_OPACITY down to nothing gives the line a
 *    body without giving it a second colour. It is derived from the stroke
 *    that is actually being drawn, so it follows whatever the ground chose —
 *    `chartColors` picks different navies per theme, and a wash pinned to a
 *    light-mode constant would have been the decomposition chart's dark-mode
 *    ghost all over again.
 *
 * 3. NOTHING ABOUT THE CURVE. Every line series in the app was already
 *    `type="monotone"`; there was no `"linear"` left to smooth and no step
 *    chart to preserve. (`investmentValuation` computes a step function, but
 *    that is the MODEL — the delta between trade dates — and no chart asks
 *    recharts for a stepped curve.) Recorded so the next reader does not go
 *    looking for the smoothing half of this module.
 *
 * ─ WHY THE WASH IS FOR ONE SERIES ONLY ─────────────────────────────────────
 * A chart drawing two washes stacks them, and two translucent fills over each
 * other make a THIRD colour that belongs to no palette — worst where it
 * matters most, since the two-series charts in this app are income against
 * expenses, the one pair a colour-blind reader already cannot separate.
 *
 * The sharper reason is measurement. Every contrast figure in `chartColors.ts`
 * is taken against a chart's CARD (`#f8f9fb` on light, `#1f2937` on dark). A
 * wash under a second series changes the ground that series is measured
 * against, and the file's own tables silently stop describing what is on
 * screen. One wash under one line changes only the ground of the line that
 * cast it, which `richLine.test.tsx` measures and holds to the 3:1 bar.
 *
 * So: `lineMarkers` everywhere a series is drawn, `seriesWash` only where the
 * chart draws a single value series. The two-series charts get part 1 and
 * stop there.
 */

/**
 * The wash at its strongest, immediately under the line — and this number was
 * MEASURED, not chosen.
 *
 * A wash changes the ground its own line is drawn on, and every contrast figure
 * in `chartColors.ts` is taken against the bare card. So the real question is
 * what a series colour measures against a tint of ITSELF over that card, and
 * the answer is decided by the weakest colour the ramp can hand a chart. The
 * first draft was 0.18, and this is what the repo's own harness said (WCAG
 * 1.4.11's 3:1 bar for a graphical object, dimmest card of each ground):
 *
 *                       bare    0.14    0.15    0.18
 *     #6b86b3 on light  3.51    3.03    3.00    2.90 ✗   <- the ceiling
 *     #8095b6 on dark   4.82    3.89    3.83    3.66
 *     #556c8f on light  5.08    4.23    4.19    4.03
 *     #2d3a4d on light 10.93    8.55    8.39    7.96
 *     #cdd4e0 on dark   9.85    6.94    6.73    6.23
 *
 * The ramp's lightest step is only 3.51:1 bare — it is the one deliberately
 * chosen to RECEDE (chartColors: the remainder slice) — so it has almost no
 * headroom to give, and at 0.18 a chart drawn in it would have dropped below
 * the bar. 0.15 lands exactly on 3.00, which is not a margin. 0.14 clears every
 * step of both ramps with room, which buys a rule that has no exceptions to
 * remember: ANY series colour the app can draw may carry a wash.
 *
 * The strength suits the house besides. An area chart claims the quantity is an
 * AREA — a total accumulating — and these are balances and valuations, which
 * are levels; a wash says "this line has a body", which is all it is being
 * asked to say. `richLine.test.tsx` re-measures the whole table, so raising
 * this fails there with the reason attached.
 */
export const WASH_TOP_OPACITY = 0.14;

/** …fading to nothing at the foot of the plot. */
export const WASH_BOTTOM_OPACITY = 0;

/**
 * The hover mark's radius — the same 4 `singlePointDot` gives a lone point,
 * deliberately. This mark is a READING aid: it says which point the tooltip is
 * quoting, and then lets the tooltip do the talking. It is not a target, so it
 * is not sized like one. A chart whose hover mark really is clickable says so
 * itself and asks for its own size, cursor and handler
 * (IncomeSpendingOverTimeReport, at r:6).
 */
export const HOVER_MARKER_RADIUS = 4;

/** What recharts is handed for `activeDot`: solid ink, the series' own colour. */
export interface HoverMarker {
  r: number;
  fill: string;
  strokeWidth: number;
}

/**
 * The mark drawn on the point under the pointer.
 *
 * Solid, in the series' own colour — the same choice `singlePointDot` made and
 * for the same reason, that a mark the reader has to hunt for is not a mark.
 * The ring STROKE is deliberately left unsaid: recharts supplies its own
 * separator, which is what already ships on the two charts that set an
 * `activeDot` today, and naming a hex here would put a colour in the app that
 * nobody ruled on.
 */
export function hoverMarker(colour: string): HoverMarker {
  return { r: HOVER_MARKER_RADIUS, fill: colour, strokeWidth: 2 };
}

/** Both mark decisions for one series, to spread onto a `<Line>` or `<Area>`. */
export interface LineMarkers {
  dot: SinglePointDot;
  activeDot: HoverMarker;
}

/**
 * How a series marks its points: none while reading, one on hover, and the
 * lone-point exception `singlePointDots` measured.
 */
export function lineMarkers(series: readonly unknown[], colour: string): LineMarkers {
  return { dot: singlePointDot(series, colour), activeDot: hoverMarker(colour) };
}

/**
 * An SVG id has to be a name, and a chart key is written by a human — so
 * anything outside the safe set becomes a hyphen rather than being trusted
 * into a `url(#…)` reference.
 */
function safe(part: string): string {
  return part.replace(/[^A-Za-z0-9_-]/g, '-');
}

/**
 * The id of the gradient a given series fills with.
 *
 * Derived, never random: `Math.random()` would give one chart a new id on every
 * render, and two charts on one page must not collide. Both halves matter —
 * the colour because that is what the gradient IS, the chart key because two
 * pages' worth of charts share one document and a reader looking at the DOM
 * should be able to tell which wash belongs to which picture.
 *
 * Two charts that pass the same key and the same colour DO produce one id
 * twice, and that is harmless by construction: the id is a function of the
 * definition, so the duplicate is a duplicate of an identical `<linearGradient>`
 * and `url(#id)` resolves to the same thing either way.
 */
export function seriesWashId(chartKey: string, colour: string): string {
  return `wt-wash-${safe(chartKey)}-${safe(colour.replace('#', '').toLowerCase())}`;
}

/** What to hand a series' `fill`, once its wash is in the chart's `<defs>`. */
export function seriesWashFill(chartKey: string, colour: string): string {
  return `url(#${seriesWashId(chartKey, colour)})`;
}

/**
 * The `<defs>` block a washed series needs, as an ELEMENT rather than a
 * component: recharts inspects its children by element type, and a literal
 * `<defs>` is what it passes through to the SVG. A `<SeriesWash />` component
 * in the same position is a child type recharts has no rule for. Measured in
 * `richLine.test.tsx` through a real chart, so this stays a fact rather than a
 * belief about the library.
 */
export function seriesWash(chartKey: string, colour: string): React.JSX.Element {
  const id = seriesWashId(chartKey, colour);
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={colour} stopOpacity={WASH_TOP_OPACITY} />
        <stop offset="100%" stopColor={colour} stopOpacity={WASH_BOTTOM_OPACITY} />
      </linearGradient>
    </defs>
  );
}
