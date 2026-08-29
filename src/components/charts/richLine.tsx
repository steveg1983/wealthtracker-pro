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
 *    ghost all over again. Its STRENGTH follows the ground too, and is passed
 *    in rather than sniffed: every washing function takes the same
 *    `isDarkGround` boolean the caller's stroke colour came from.
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
 * The wash at its strongest, immediately under the line — ONE NUMBER PER
 * GROUND, and both were MEASURED, not chosen.
 *
 * A wash changes the ground its own line is drawn on, and every contrast figure
 * in `chartColors.ts` is taken against the bare card. So the real question is
 * what a series colour measures against a tint of ITSELF over that card, and
 * the answer is decided by the weakest colour the ramp can hand a chart. The
 * repo's own harness, at WCAG 1.4.11's 3:1 bar for a graphical object, against
 * the dimmest card each ground uses (`#f8f9fb` light, `#1f2937` dark):
 *
 *     over #f8f9fb      bare    0.14    0.15    0.18
 *       #6b86b3         3.51    3.03    3.00    2.90 ✗   <- the light ceiling
 *       #556c8f         5.08    4.23    4.19    4.03
 *       #41526e         7.50    6.07    5.98    5.69
 *       #2d3a4d        10.93    8.55    8.39    7.96
 *       #1a2332        14.98   11.39   11.17   10.43
 *
 *     over #1f2937      bare    0.14    0.20    0.22
 *       #6b86b3         3.97    3.31    3.03    2.97 ✗   <- the dark ceiling
 *       #8095b6         4.82    3.89    3.51    3.40
 *       #94a3b8         5.72    4.49    4.03    3.85
 *       #b1bccc         7.64    5.65    4.97    4.74
 *       #cdd4e0         9.85    6.94    5.91    5.58
 *
 * THE SAME COLOUR SETS BOTH CEILINGS, which is not a coincidence: #6b86b3 is
 * the one step of the axis legible on both grounds (chartColors), so it is the
 * lowest-contrast step of BOTH ramps — and it is deliberately so, being where a
 * capped series puts its folded remainder. It has the least headroom to give on
 * either ground, and both constants are the point where it lands on 3.03:1: one
 * notch further (light 0.15 → 3.00, dark 0.205 → 3.02, 0.21 → below) is not a
 * margin. So the rule still has no exceptions to remember: ANY series colour
 * the app can draw may carry a wash, on either ground.
 *
 * ─ WHY DARK NEEDED ITS OWN NUMBER (owner, 29 Aug) ──────────────────────────
 * "In dark mode, the shaded area below the line isn't as visible." He is
 * looking at the same 0.14 on both grounds, and the honest reading of the
 * measurements is that the arithmetic was never wrong — in CIE L*, how far the
 * wash moves its own card:
 *
 *                          weakest step   strongest step
 *     light @0.14           5.72 ΔL*       10.54 ΔL*
 *     dark  @0.14           6.03 ΔL*       10.91 ΔL*     <- already the larger
 *     dark  @0.20           8.66 ΔL*       15.33 ΔL*
 *
 * The dark wash at 0.14 already moved its ground FURTHER than the light one
 * moves its own. What differs is the eye, not the number: the same lightness
 * step is harder to see at the near-black end, and a screen in a lit room adds
 * a flare that compresses that end further. Nothing in a contrast ratio reports
 * that. So the remedy is not a correction, it is spending the headroom the dark
 * ground actually has — all of it, up to its own measured ceiling.
 *
 * ─ THE OWNER'S OTHER SUGGESTION, MEASURED AND DECLINED ─────────────────────
 * "…a lighter grey / white sort of shade?" A neutral wash was measured the same
 * way — white over #1f2937, then every dark series read against that composite
 * ground. Its ceiling is α 0.090 (#6b86b3 at 3.02; 0.095 fails at 2.97), giving
 * ΔL* 8.73 — the SAME 8.73 for every chart, because the ground no longer
 * depends on the series. Against the stroke-derived wash at 0.20 that is a
 * dead heat on the weakest step (8.66) and a loss everywhere the app actually
 * draws one: #94a3b8 gets 10.91 and #cdd4e0 15.33, 25% and 76% more movement
 * for the same compliance. So the numbers say what the idiom already said —
 * a neutral fill under a coloured line is a second instrument, and here it is
 * also the dimmer one. The wash stays the line's own colour.
 *
 * ─ ONE MORE MEASURED FACT, RECORDED WHERE IT MATTERS ───────────────────────
 * The semantic pair has no dark headroom worth the name: `expense` (#d94052)
 * is 3.36:1 bare on a dark card, 3.01 at the light constant — over the bar by a
 * hundredth, which is not a margin — and 2.82 at the dark one. The two-series
 * charts already decline the wash for the reason at the top of this file; this
 * is why they could not have taken it on a dark ground regardless.
 *
 * The strength suits the house besides. An area chart claims the quantity is an
 * AREA — a total accumulating — and these are balances and valuations, which
 * are levels; a wash says "this line has a body", which is all it is being
 * asked to say. `richLine.test.tsx` re-measures both tables against the live
 * ramps, so raising either constant — or adding a series colour with less
 * headroom than #6b86b3 — fails there, by name, with the reason attached.
 */
export const WASH_TOP_OPACITY = { light: 0.14, dark: 0.2 } as const;

/**
 * The wash strength for the ground being drawn on. Takes the flag rather than
 * reading the `dark` class itself, so that the wash and the stroke it is
 * derived from come from ONE reading of the ground per render — the caller
 * already has that boolean, because its stroke colour was chosen with it.
 */
export function washTopOpacity(isDarkGround: boolean): number {
  return isDarkGround ? WASH_TOP_OPACITY.dark : WASH_TOP_OPACITY.light;
}

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
 * render, and two charts on one page must not collide. Every half matters —
 * the colour and the opacity because together they are what the gradient IS,
 * the chart key because two pages' worth of charts share one document and a
 * reader looking at the DOM should be able to tell which wash belongs to which
 * picture.
 *
 * THE OPACITY IS IN THE ID BECAUSE THE ID IS A FUNCTION OF THE DEFINITION, and
 * since 29 Aug the definition depends on the ground. Without it a chart whose
 * stroke colour does NOT change with the theme — the custom report builder can
 * store a `borderColor` with a dataset — would ask for the same id after dusk,
 * find the light-ground gradient already in the document, and keep drawing the
 * weaker wash. Same key, same colour, same ground still produces one id twice,
 * and that stays harmless for the original reason: the duplicate is a duplicate
 * of an identical `<linearGradient>`, so `url(#id)` resolves to the same thing
 * either way.
 */
export function seriesWashId(chartKey: string, colour: string, isDarkGround: boolean): string {
  const strength = safe(String(washTopOpacity(isDarkGround)));
  return `wt-wash-${safe(chartKey)}-${safe(colour.replace('#', '').toLowerCase())}-${strength}`;
}

/** What to hand a series' `fill`, once its wash is in the chart's `<defs>`. */
export function seriesWashFill(chartKey: string, colour: string, isDarkGround: boolean): string {
  return `url(#${seriesWashId(chartKey, colour, isDarkGround)})`;
}

/**
 * The `<defs>` block a washed series needs, as an ELEMENT rather than a
 * component: recharts inspects its children by element type, and a literal
 * `<defs>` is what it passes through to the SVG. A `<SeriesWash />` component
 * in the same position is a child type recharts has no rule for. Measured in
 * `richLine.test.tsx` through a real chart, so this stays a fact rather than a
 * belief about the library.
 *
 * `isDarkGround` is REQUIRED rather than defaulted: a wash that quietly assumed
 * a light ground is exactly the bug being fixed, and a required argument makes
 * the compiler name every chart that draws one.
 */
export function seriesWash(chartKey: string, colour: string, isDarkGround: boolean): React.JSX.Element {
  const id = seriesWashId(chartKey, colour, isDarkGround);
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={colour} stopOpacity={washTopOpacity(isDarkGround)} />
        <stop offset="100%" stopColor={colour} stopOpacity={WASH_BOTTOM_OPACITY} />
      </linearGradient>
    </defs>
  );
}
