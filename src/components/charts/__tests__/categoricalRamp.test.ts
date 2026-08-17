/**
 * The one categorical chart ramp, instrumented — RULINGS_ON_CAUSE_2026-08-13 §2.
 *
 * The app used to carry NINE categorical palettes under six names, three of
 * them the recharts documentation example verbatim. This file is the gate that
 * keeps it at one, and it pins the two things the ruling actually cares about:
 *
 * 1. NO SIXTH PALETTE. No chart component may declare its own array of hex
 *    colours. The check greps the chart consumers rather than trusting review,
 *    because that is precisely what nine palettes got past.
 *
 * 2. THE RAMP IS VISIBLE, AND IT IS NOT A SIGNAL. Every step clears the 3:1
 *    WCAG bar a graphical object owes, measured with the repo's own harness
 *    against BOTH surfaces of its own theme — the same rule
 *    semantic-contrast.test.ts enforces for text, and the reason the ramp has
 *    to depend on the ground at all. And no step may be confusable with income
 *    green or expense red, because those two hues state whether money came in
 *    or went out and a pie slice must never borrow them.
 *
 * No exact hue is pinned beyond the ruled five: a future rebrand only has to
 * keep the measuring honest.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ColorContrastChecker } from '../../../utils/color-contrast-checker';
import { CATEGORICAL_AXIS, categoricalColor, categoricalRamp } from '../chartColors';

const AA_GRAPHICS = 3.0;
const SURFACES_LIGHT = ['#ffffff', '#f8f9fb'] as const;
const SURFACES_DARK = ['#111827', '#1f2937'] as const;

/** The five the ruling named. They must survive any re-derivation of the axis. */
const RULED = ['#1a2332', '#2d3a4d', '#6b86b3', '#94a3b8', '#cdd4e0'] as const;

/** Every module that draws a categorical chart, relative to the repo root. */
const CHART_CONSUMERS = [
  'src/components/charts/DashboardCharts.tsx',
  'src/components/CustomReportViewer.tsx',
  'src/components/dashboard/ImprovedDashboard.tsx',
  'src/components/dashboard/reportWidgets/DashboardReportWidgets.tsx',
  'src/pages/Investments.tsx',
  'src/pages/reports/AccountDistributionReport.tsx',
  'src/pages/reports/SpendingByCategoryReport.tsx',
  'src/pages/reports/SpendingByPayeeReport.tsx',
] as const;

const read = (repoPath: string): string =>
  readFileSync(resolve(process.cwd(), repoPath), 'utf8');

/** Strip comments so the prose explaining the old palettes is not mistaken for one. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the categorical ramp is the only chart palette', () => {
  it('the axis IS the ruled five', () => {
    // Until 17 August the axis held nine stops — the ruled five plus bisected
    // midpoints — and the bisection was the bug Design's §2.2 found: the dark
    // half of the axis is compressed, so its midpoints landed ~1.17:1 from
    // their neighbours and three legend swatches read as one colour. Ramp
    // members are now interpolated evenly in L* (see chartColors), so the
    // axis exports only what was actually ruled.
    expect(CATEGORICAL_AXIS.map(c => c.toLowerCase())).toEqual([...RULED]);
  });

  it('every ruled value still appears in at least one ramp', () => {
    const members = new Set(
      [...categoricalRamp(false), ...categoricalRamp(true)].map(c => c.toLowerCase())
    );
    for (const colour of RULED) {
      expect(members, `${colour} fell out of both ramps`).toContain(colour);
    }
  });

  /**
   * THE §2.2 INSTRUMENT (Claude Design, 17 Aug). The shipped light ramp had
   * "maximum adjacent separation" in ratio terms and was still unreadable,
   * because three of its five steps were near-identical and only ADJACENT
   * pairs had ever been measured. So both floors are pinned: consecutive
   * slices must separate (≥1.5:1), and NO pair anywhere in a ramp may fall
   * back into the indistinguishable band (<1.15:1) — measured, not
   * remembered. The light five sit ΔL* ≈ 10.5 apart; light's worst adjacent
   * pair measures 2.00:1 and its worst overall 1.37:1; dark's are 1.59:1 and
   * 1.19:1.
   */
  it.each([['light', false], ['dark', true]] as const)(
    'no two %s-ground steps collapse into one colour',
    (_name, isDark) => {
      const ramp = categoricalRamp(isDark);
      for (let i = 0; i < ramp.length - 1; i++) {
        const adjacent = ColorContrastChecker.getContrastRatio(ramp[i], ramp[i + 1]);
        expect(
          adjacent,
          `consecutive slices ${ramp[i]} and ${ramp[i + 1]} measure ${adjacent.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(1.5);
      }
      for (let i = 0; i < ramp.length; i++) {
        for (let j = i + 1; j < ramp.length; j++) {
          const pair = ColorContrastChecker.getContrastRatio(ramp[i], ramp[j]);
          expect(
            pair,
            `${ramp[i]} and ${ramp[j]} measure ${pair.toFixed(2)}:1 — legend swatches this close read as one`
          ).toBeGreaterThanOrEqual(1.15);
        }
      }
    }
  );

  it.each([
    ['light', false, '#f8f9fb'],
    ['dark', true, '#1f2937'],
  ] as const)(
    'the last %s-ground step is the quietest — where the folded remainder sits',
    (_name, isDark, dimmestSurface) => {
      // capSeriesWithRemainder and buildAccountDistribution put "the rest" in
      // the fifth slice, and Design's §2.1 ruling puts the remainder at the
      // ramp's lightest step. Painting slices in ramp order delivers that only
      // if the last step really is the lowest-contrast one on its own ground.
      const ramp = categoricalRamp(isDark);
      const contrasts = ramp.map(c => ColorContrastChecker.getContrastRatio(c, dimmestSurface));
      expect(contrasts[contrasts.length - 1]).toBe(Math.min(...contrasts));
    }
  );

  it.each([
    ['light', false, SURFACES_LIGHT],
    ['dark', true, SURFACES_DARK],
  ] as const)('every %s-ground step clears the 3:1 graphics bar on both its surfaces', (_name, isDark, surfaces) => {
    const ramp = categoricalRamp(isDark);
    expect(ramp.length).toBeGreaterThan(0);
    for (const colour of ramp) {
      for (const surface of surfaces) {
        const ratio = ColorContrastChecker.getContrastRatio(colour, surface);
        expect(
          ratio,
          `${colour} on ${surface} measures ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(AA_GRAPHICS);
      }
    }
  });

  it.each([['light', false], ['dark', true]] as const)(
    'spends no signal: no %s-ground step is a green or a red',
    (_name, isDark) => {
      for (const colour of categoricalRamp(isDark)) {
        const { r, g, b } = ColorContrastChecker.hexToRgb(colour);
        // Navy through slate is blue-dominant and near-neutral. Income green
        // and expense red are the two channels a categorical slice may never
        // lead with, so blue must not be the quietest channel.
        expect(b, `${colour} is not on the navy-slate axis`).toBeGreaterThanOrEqual(r);
        expect(b, `${colour} is not on the navy-slate axis`).toBeGreaterThanOrEqual(g);
      }
    }
  );

  it('cycles past the end of the ramp rather than running out', () => {
    const ramp = categoricalRamp(false);
    expect(categoricalColor(ramp, 0)).toBe(ramp[0]);
    expect(categoricalColor(ramp, ramp.length)).toBe(ramp[0]);
    expect(categoricalColor(ramp, ramp.length + 2)).toBe(ramp[2]);
  });

  it('leaves no chart component declaring a palette of its own', () => {
    // A palette has a SHAPE: an array literal of three or more hex strings.
    // That is what all nine deleted ones looked like, and matching the shape
    // rather than counting hexes is what lets axis-tick greys and a deliberate
    // two-colour income/expense pair through — those are chrome and meaning,
    // neither of them a categorical ramp.
    const PALETTE_SHAPE = /\[[^\]]*(?:['"]#[0-9a-fA-F]{3,8}['"][^\]]*){3,}\]/g;
    for (const path of CHART_CONSUMERS) {
      const found = withoutComments(read(path)).match(PALETTE_SHAPE) ?? [];
      expect(found, `${path} declares a palette of its own: ${found.join(' ')}`).toEqual([]);
    }
  });
});
