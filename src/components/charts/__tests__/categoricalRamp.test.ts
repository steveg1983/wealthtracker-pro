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
  it('keeps the five ruled values in the axis', () => {
    for (const colour of RULED) {
      expect(CATEGORICAL_AXIS.map(c => c.toLowerCase())).toContain(colour);
    }
  });

  it('bisects rather than inventing steps: the ruled five sit at even indices', () => {
    // The extension rule is stated, not ad hoc — each adjacent ruled pair gets
    // its midpoint, so a nine-step axis holds the five at 0, 2, 4, 6, 8.
    expect(CATEGORICAL_AXIS).toHaveLength(9);
    expect([0, 2, 4, 6, 8].map(i => CATEGORICAL_AXIS[i].toLowerCase())).toEqual([...RULED]);
  });

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
