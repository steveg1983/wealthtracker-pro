/**
 * How a line series draws a window that holds a single point.
 *
 * ─ THE SYMPTOM, AND WHAT IT ACTUALLY IS ────────────────────────────────────
 * Pinning a period-filtered line chart to a one-month window (the Dashboard's
 * "Income vs Expenses" on `This month`) leaves the card looking like a chart
 * that failed to load: axes, grid and legend around what reads as an empty
 * plot. In a finance app the reader's next thought is about their data, not
 * about recharts, which is what makes it worth fixing rather than tolerating.
 *
 * The obvious diagnosis is that nothing is drawn — a `<Line>` draws the
 * segments BETWEEN points, so one point yields no path. MEASURED against the
 * real recharts in this repo, that is only half true, and the other half is
 * what decides the fix:
 *
 *     ONE point,   dot={false}   curves=0   dots=1   r=3 stroke=<series> stroke-width=2 fill=#fff
 *     ONE point,   dot={true}    curves=0   dots=1   r=3 stroke=<series> stroke-width=2 fill=#fff
 *     THREE points,dot={false}   curves=1   dots=0
 *
 * Two things follow, and both are load-bearing:
 *
 * 1. **The point IS drawn.** recharts already special-cases a lone point, so
 *    the plot is not empty — it holds a 6px circle whose fill is WHITE and
 *    whose only ink is a 2px ring. On a white card, in a ~200px-tall widget,
 *    that is a speck. The chart does not look broken because nothing is
 *    there; it looks broken because what is there is nearly invisible.
 *
 * 2. **The boolean is inert.** `dot={false}` and `dot={true}` produce the
 *    identical element for a one-point series. So the tempting one-liner —
 *    `dot={data.length === 1}` — changes not a single rendered pixel. It
 *    would have read like a fix, passed review, and left the card exactly as
 *    it was.
 *
 * ─ THE FIX ─────────────────────────────────────────────────────────────────
 * Give the lone point a dot CONFIG rather than a boolean: solid, in the
 * series' own colour, slightly larger than the default ring. A single filled
 * mark states "one month, this value" — which is the true shape of the data,
 * not a degenerate version of a line.
 *
 * Multi-point series keep `false`, which is what they already had and still
 * want: dots on a two-hundred-point series are noise, and these charts carry
 * their click target on the CHART rather than on each dot.
 *
 * An AREA chart has the same defect for the same reason and takes the same
 * treatment; there are none in the app today, and this sentence is here so
 * the next one added does not have to rediscover it. A BAR chart needs none
 * of this — one bar is one rectangle, and it renders.
 *
 * Stated once, for the same reason `categoricalColor` is a function: five
 * call sites spelling this inline is five chances to spell it differently,
 * and this one is subtle enough that the wrong version looks right.
 */

/** What recharts wants for a visible single mark; `false` is "draw no dots". */
export type SinglePointDot = false | { r: number; fill: string; strokeWidth: number };

export function singlePointDot(series: readonly unknown[], colour: string): SinglePointDot {
  return series.length === 1 ? { r: 4, fill: colour, strokeWidth: 0 } : false;
}
