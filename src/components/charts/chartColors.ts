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
export function useCategoricalRamp(): readonly string[] {
  const [dark, setDark] = useState(isDarkGround);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(isDarkGround()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    // The class can change between first render and this effect running.
    setDark(isDarkGround());
    return () => observer.disconnect();
  }, []);

  return categoricalRamp(dark);
}
