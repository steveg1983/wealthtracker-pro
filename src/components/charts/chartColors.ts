import type React from 'react';
import { useEffect, useState } from 'react';

/**
 * THE categorical chart ramp. One module, one ramp, every chart reads it.
 *
 * ─ WHAT WAS HERE BEFORE, AND WHAT IT COST ──────────────────────────────────
 * Nobody ever chose a chart palette. There were NINE arrays under six names:
 * `DEFAULT_COLORS` in DashboardCharts, `COLORS` in ImprovedDashboard, another
 * `COLORS` in AccountDistributionReport, `CATEGORY_COLORS` in
 * CustomReportViewer, another in DashboardReportWidgets, a third in
 * SpendingByCategoryReport, `BAR_COLOURS` in SpendingByPayeeReport, a fourth
 * `COLORS` in Investments, and a ten-colour `CHART_COLORS` right here that no
 * component ever rendered a pixel with. Three of them were the recharts
 * documentation example verbatim; the Investments one had silently drifted
 * from its twin at positions seven and eight.
 *
 * The cost was not ugliness, it was MEANING. `#00C49F` and `#10B981` are close
 * enough to income green, and `#FF8042`/`#EF4444` to expense red, that a pie
 * slice sat inches from a Performance card where those two hues state whether
 * money came in or went out. Every rainbow slice spent a signal the register
 * needs (P2 — colour is a signal, never a surface). So the ramp is navy
 * through slate, and GREEN AND RED ARE NEVER IN IT
 * (RULINGS_ON_CAUSE_2026-08-13 §2).
 *
 * They were deleted rather than aligned: five palettes agreeing today is five
 * palettes drifting next month, which is exactly how Investments got its two
 * odd colours.
 *
 * ─ WHY THE RAMP DEPENDS ON THE GROUND ──────────────────────────────────────
 * The ruled five span the whole navy→slate axis, and MEASURED against the
 * repo's own harness that means no single ordering works on both themes. Against
 * the dimmest surface each theme actually uses (`#f8f9fb` cards on light,
 * `#1f2937` on dark), at the 3:1 WCAG bar a graphical object owes:
 *
 *     #1a2332   light 14.98 ✓   dark  1.08 ✗   <- invisible on a dark card
 *     #2d3a4d   light 10.93 ✓   dark  1.27 ✗
 *     #6B86B3   light  3.51 ✓   dark  3.97 ✓   <- the only step good on both
 *     #94a3b8   light  2.43 ✗   dark  5.72 ✓
 *     #cdd4e0   light  1.41 ✗   dark  9.85 ✓   <- invisible on a white card
 *
 * A fixed ramp would therefore have shipped two invisible slices in one theme
 * or the other — the old rainbow was mid-bright and dodged this by accident.
 * So the ramp is ONE axis walked from whichever END contrasts with the ground:
 * darkest-first on light, lightest-first on dark. Same axis, same five ruled
 * values, no second palette.
 *
 * ─ HOW IT EXTENDS PAST FIVE ────────────────────────────────────────────────
 * Some charts draw more series than five (SpendingByCategory draws eight). The
 * stated rule is BISECTION, never a new hue: each adjacent pair of ruled values
 * gets its midpoint, giving a nine-step axis of which the ruled five are still
 * exactly members. Five of those nine clear 3:1 on any one ground, so each
 * theme gets a five-colour ramp and beyond that the ramp CYCLES.
 *
 * Cycling is the honest cost of the ruling. A single-hue ramp cannot separate
 * eight categories the way eight hues could — measured, adjacent steps here sit
 * 2.12:1 apart on light and 1.59:1 on dark. Charts must therefore direct-label,
 * which these already do: every consumer draws a legend swatch beside the name
 * or names the slice in its tooltip. Colour groups the series; the label
 * identifies it.
 */

/**
 * The axis: the ruled five (index 0, 2, 4, 6, 8) with a bisected midpoint
 * between each adjacent pair. Dark end first. Exported for the test that pins
 * the ruled values and the contrast of everything derived from them.
 */
export const CATEGORICAL_AXIS = [
  '#1a2332', // navy-900  — ruled
  '#242f40', //           — bisected
  '#2d3a4d', // navy-700  — ruled
  '#4c6080', //           — bisected
  '#6b86b3', // navy-400  — ruled
  '#8095b6', //           — bisected
  '#94a3b8', // slate-400 — ruled
  '#b1bccc', //           — bisected
  '#cdd4e0', // line-strong — ruled
] as const;

/**
 * The five axis steps that clear 3:1 on a LIGHT ground, ordered so that
 * CONSECUTIVE series are as far apart as the axis allows (2.12:1 worst
 * adjacent pair). Walking the axis in order instead would put neighbouring pie
 * slices 1.17:1 apart, which is no separation at all.
 */
const RAMP_ON_LIGHT = ['#1a2332', '#4c6080', '#242f40', '#6b86b3', '#2d3a4d'] as const;

/** The same, from the light end, for a dark ground (1.59:1 worst adjacent pair). */
const RAMP_ON_DARK = ['#94a3b8', '#cdd4e0', '#8095b6', '#b1bccc', '#6b86b3'] as const;

/**
 * HOW MANY SLICES A CHART MAY DRAW.
 *
 * Five, because the ramp is five, because the axis is ONE HUE walked and each
 * ground can only use the half of it that clears 3:1 against that ground. Ask
 * for a sixth and `categoricalColor` cycles: slice 6 is painted exactly like
 * slice 1, and the picture stops being readable in a way no contrast figure
 * reports — the Dashboard's expense donut drew six against five and two
 * categories shared a colour.
 *
 * So the cap is not a layout preference, it is the palette's own arithmetic,
 * and it belongs beside the palette rather than as a number in each widget.
 * A chart with more than five things to say needs a grouped remainder, not a
 * longer ramp.
 */
export const MAX_CATEGORICAL_SERIES = 5;

/**
 * The slices a chart may draw, with everything past the ceiling folded into one
 * named remainder.
 *
 * Written once because it went wrong three times in the same week, identically:
 * the Dashboard's expense donut, the Investments allocation ring and the custom
 * report viewer's pie each drew more series than the ramp has colours, so the
 * sixth slice was painted like the first.
 *
 * The remainder is NAMED WITH ITS COUNT ("8 smaller accounts") rather than
 * called "Other", for two reasons: "Other" is a real category in some ledgers
 * and would collide, and a reader who can see how many things were folded can
 * tell whether the fold hid something worth looking at.
 *
 * Callers must draw the ring AND the legend from the returned array. Drawing
 * the ring from the raw data and the legend from this is precisely the bug it
 * exists to prevent.
 */
export function capSeriesWithRemainder<T>(
  items: readonly T[],
  value: (item: T) => number,
  name: (item: T) => string,
  remainderLabel: (count: number) => string
): Array<{ name: string; value: number }> {
  const all = items.map((item) => ({ name: name(item), value: value(item) }));
  if (all.length <= MAX_CATEGORICAL_SERIES) return all;

  const shown = all.slice(0, MAX_CATEGORICAL_SERIES - 1);
  const rest = all.slice(MAX_CATEGORICAL_SERIES - 1);
  return [
    ...shown,
    {
      name: remainderLabel(rest.length),
      value: rest.reduce((sum, entry) => sum + entry.value, 0)
    }
  ];
}

/** The ramp for a given ground. Cycle past the end with `categoricalColor`. */
export function categoricalRamp(isDarkGround: boolean): readonly string[] {
  return isDarkGround ? RAMP_ON_DARK : RAMP_ON_LIGHT;
}

/**
 * The colour for series `index`, cycling once the ramp runs out. Every chart
 * used to spell `PALETTE[i % PALETTE.length]` at each call site; going through
 * one function means the cycling rule is stated once.
 */
export function categoricalColor(ramp: readonly string[], index: number): string {
  return ramp[index % ramp.length] as string;
}

/** Is the app currently painting on a dark ground? */
function isDarkGround(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

/**
 * The ramp for the theme on screen right now.
 *
 * It watches the `dark` class rather than reading it once, because the class is
 * toggled on `<html>` directly (PreferencesContext, and the theme scheduler
 * that can flip it at dusk with no React state change behind it). Read once at
 * render — which is what the Dashboard's tooltip colours still do — a chart
 * would keep its light-ground slices after the app went dark, and two of them
 * would be invisible until something unrelated forced a re-render.
 */
export function useIsDarkGround(): boolean {
  const [dark, setDark] = useState(isDarkGround);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(isDarkGround()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    // The class can change between first render and this effect running.
    setDark(isDarkGround());
    return () => observer.disconnect();
  }, []);

  return dark;
}

export function useCategoricalRamp(): readonly string[] {
  return categoricalRamp(useIsDarkGround());
}

/**
 * The Recharts tooltip surface, for the ground currently on screen.
 *
 * Four charts spelled `rgba(255, 255, 255, 0.95)` with a `#ccc` border inline.
 * That is readable in dark mode — Recharts' own label text is dark, so it is
 * dark-on-white — but it is a white card thrown onto a near-black page, which
 * reads as a rendering fault rather than a design.
 *
 * It watches the `dark` class through the same hook as the ramp, and for the
 * same reason: the class is toggled on `<html>` directly, so a value read once
 * at render survives into the wrong theme.
 */
export function useChartTooltipStyle(): React.CSSProperties {
  const dark = useIsDarkGround();
  return dark
    ? {
        backgroundColor: 'rgba(31, 41, 55, 0.97)', // gray-800
        border: '1px solid #4b5563', // gray-600
        borderRadius: '8px',
        color: '#f9fafb',
      }
    : {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #ccc',
        borderRadius: '8px',
        color: '#111827',
      };
}

/**
 * ─ THE TWO SEMANTIC SERIES — NOT PART OF THE RAMP ABOVE ────────────────────
 *
 * Everything above this line is the CATEGORICAL ramp: colours that separate
 * one arbitrary slice from another and mean nothing individually. These two
 * mean something. A series called "Income" is the same idea as a `+£141.50`
 * in the register, and it had been painted `#10B981`/`#EF4444` in five files —
 * a SECOND definition of income and expense, living beside the instrumented
 * one and free to drift from it (PHONE_CAPTURES_REVIEW_2026-08-13 §4).
 *
 * That is why green and red are still banned from the ramp and are declared
 * here instead: the ban was never on the hues, it was on spending them where
 * they mean nothing. A chart of income against expenses is the one place in a
 * chart they mean exactly what they mean everywhere else.
 *
 * ─ WHY THESE ARE THE FILL COLOURS AND NOT text-income / text-expense ───────
 * WCAG asks 4.5:1 of text and 3:1 of a graphical object (1.4.11). The amount
 * colours are built for the harder bar and are correspondingly dark; a 1.5px
 * line in a dark green reads as black on a chart. The token sheet already had
 * `income-fill` for exactly this, being the green the amounts gave up when
 * they moved to the 4.5:1 pair — `expense-fill` is now its counterpart, the
 * red they gave up in the same change. So the series pair is the retired text
 * pair, which is why it is the same family of colour and not a new one.
 *
 * ─ WHY ONE VALUE SERVES BOTH THEMES, WHEN THE RAMP NEEDED TWO ──────────────
 * The ramp walks navy→slate, so its ends are invisible on one ground or the
 * other and it has to be entered from the end that contrasts. These two sit in
 * the middle of the lightness range, and MEASURED with the repo's own harness
 * (ColorContrastChecker, 2026-08-13) they clear the 3:1 graphics bar on every
 * surface a chart is drawn on in either theme:
 *
 *                     #fff   #f8f9fb   #1f2937   #111827
 *     income-fill     3.38     3.21      4.34      5.24   ✓ all four
 *     expense-fill    4.37     4.15      3.36      4.06   ✓ all four
 *
 * Both are deliberately under 4.5:1 on white: they are series colours, and
 * `semantic-contrast.test.ts` fails if one is promoted to text.
 *
 * ─ THE COST, STATED ────────────────────────────────────────────────────────
 * Green against red is the one pair colour-blind readers cannot separate, and
 * these two are 1.29:1 apart in luminance, so contrast does not rescue it
 * either. Every consumer therefore direct-labels: each of the four charts
 * draws a `<Legend />` and names the series in its tooltip, which is the same
 * rule the ramp above works under — colour groups the series, the label
 * identifies it. A chart that cannot label its series must not use this pair.
 *
 * Declared in `tailwind.config.js` (`income-fill` / `expense-fill`) and
 * mirrored here because recharts takes a colour, not a class name. The mirror
 * is pinned to the token sheet by semantic-contrast.test.ts, the same way the
 * amount colours are pinned across their three files — a copy nobody checks is
 * how there came to be five palettes.
 */
export const SEMANTIC_SERIES = {
  income: '#0d9f6f',
  expense: '#d94052',
} as const;

/**
 * A measurement drawn beside the parts it is made of — separated by SHAPE, in
 * one hue (design ruling, 2026-08-13 night, §3.1).
 *
 * ── WHY NOT THREE COLOURS ───────────────────────────────────────────────────
 *
 * Net worth over time draws three lines, and they were income-green and
 * expense-red, which said the wrong thing twice: assets and liabilities are
 * MAGNITUDES, not money in and out, and colouring them that way reinstated on
 * the chart exactly what the design pass had removed from the summary card two
 * inches above it.
 *
 * The obvious repair — three steps of the categorical ramp — fails, measured:
 * ramp indices 0 and 2 are 1.17:1 apart on light and 1.19:1 on dark, so Net
 * worth and Liabilities come out the same colour. Nothing in a navy→slate axis
 * separates three traceable lines on both grounds.
 *
 * A third HUE was the other option and was refused for a better reason than
 * contrast. These are not three categories: assets and liabilities are the two
 * components of net worth, one measurement decomposed, exactly as the summary
 * card's three cells are. A hue of its own would assert that liabilities are a
 * third unrelated thing — the same false statement the green and red were
 * making.
 *
 * So shape carries identity, weight carries hierarchy, and one hue says these
 * belong to each other. It survives greyscale, print and a colour-blind reader,
 * none of which a third hue would have given.
 *
 * ── THE CONDITION THE RULING CAME WITH ──────────────────────────────────────
 *
 * The legend must show the ACTUAL dash pattern. Three identical navy squares
 * would be worse than the bug this replaces, so the chart supplies its own
 * legend content rather than trusting recharts' default swatch — see
 * NetWorthReport. `dash` is `strokeDasharray`; `undefined` is a solid line.
 */
export const DECOMPOSITION_SERIES = {
  /** The answer. Solid and heaviest — the other two explain it. */
  total: { color: CATEGORICAL_AXIS[0], width: 2.5, dash: undefined },
  /** A component. Same hue, dashed. */
  part: { color: CATEGORICAL_AXIS[2], width: 1.5, dash: '6 3' },
  /** The other component. Same hue again, dotted, so the two parts differ. */
  counterpart: { color: CATEGORICAL_AXIS[2], width: 1.5, dash: '1 3' },
} as const;
