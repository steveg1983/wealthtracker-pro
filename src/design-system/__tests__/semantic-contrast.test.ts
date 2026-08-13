/**
 * The semantic amount colours, instrumented — DESIGN_PASS_2026-08 §2.1.
 *
 * The design pass proposed new income/expense colours from CALCULATED ratios
 * and asked for them to be measured in this repo's own harness before landing.
 * This file is that instrument, kept as a gate. Two things are pinned:
 *
 * 1. AGREEMENT. The same colour lives in three files — `tailwind.config.js`
 *    (the utility tokens), `src/index.css` (the CSS variables), and
 *    `src/styles/accessibility-colors.css` (the !important remap that is what
 *    actually paints `text-green-600` / `text-red-600` amounts today). Before
 *    2026-08-12 they disagreed: the tokens said #0d9f6f/#d94052 while the
 *    remap painted #047857/#b91c1c, so "measuring the token" measured nothing
 *    on screen. Drift between the three is a failure here.
 *
 * 2. CONTRAST. Every text pair clears WCAG AA (4.5:1), measured — not
 *    asserted from memory — on BOTH light surfaces (white cards and the
 *    #f8f9fb page behind them) and, for the dark pair, on BOTH dark surfaces
 *    (gray-900 page, gray-800 cards). The doc's own dark suggestion (#0d9f6f
 *    as dark text) died on exactly that second surface: 5.24:1 on gray-900
 *    but 4.34:1 on the cards where amounts actually sit.
 *
 * No hue is pinned — a future rebrand only has to keep measuring honest.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE (pinned at Claude Design's own request,
 * after its calculated figures failed here twice): contrast is measured
 * against the SURFACE the text sits on, not the page it sits in. A colour
 * that clears the gray-900 page can fail the gray-800 card two pixels away —
 * which is exactly how #0d9f6f died as a dark-mode text candidate. Every pair
 * below therefore measures against BOTH surfaces of its mode.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ColorContrastChecker } from '../../utils/color-contrast-checker';
import { CATEGORICAL_AXIS, SEMANTIC_SERIES } from '../../components/charts/chartColors';

const read = (repoPath: string): string =>
  readFileSync(resolve(process.cwd(), repoPath), 'utf8');

const tailwindConfig = read('tailwind.config.js');
const indexCss = read('src/index.css');
const remapCss = read('src/styles/accessibility-colors.css');

function extract(source: string, pattern: RegExp, where: string): string {
  const match = source.match(pattern);
  if (match === null) {
    throw new Error(`No colour found for ${where} — has the declaration moved?`);
  }
  return match[1].toLowerCase();
}

const AA_TEXT = 4.5;
const AA_GRAPHICS = 3.0;
const SURFACES_LIGHT = ['#ffffff', '#f8f9fb'] as const;
const SURFACES_DARK = ['#111827', '#1f2937'] as const;

const token = {
  income: extract(tailwindConfig, /\bincome: '(#[0-9a-f]{6})'/i, 'tailwind income'),
  incomeFill: extract(tailwindConfig, /'income-fill': '(#[0-9a-f]{6})'/i, 'tailwind income-fill'),
  expense: extract(tailwindConfig, /\bexpense: '(#[0-9a-f]{6})'/i, 'tailwind expense'),
  expenseFill: extract(tailwindConfig, /'expense-fill': '(#[0-9a-f]{6})'/i, 'tailwind expense-fill'),
  accentText: extract(tailwindConfig, /'accent-text': '(#[0-9a-f]{6})'/i, 'tailwind accent-text'),
};

const cssVar = {
  income: extract(indexCss, /--color-income: (#[0-9a-f]{6})/i, '--color-income'),
  expense: extract(indexCss, /--color-expense: (#[0-9a-f]{6})/i, '--color-expense'),
};

const rendered = {
  income: extract(remapCss, /\.text-green-600\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i, '.text-green-600 remap'),
  expense: extract(remapCss, /\.text-red-600\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i, '.text-red-600 remap'),
  darkIncome: extract(remapCss, /\.dark \.dark\\:text-green-400\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i, 'dark income remap'),
  darkExpense: extract(remapCss, /\.dark \.dark\\:text-red-400\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i, 'dark expense remap'),
};

const ratio = (fg: string, bg: string): number =>
  ColorContrastChecker.getContrastRatio(fg, bg);

describe('semantic amount colours (DESIGN_PASS_2026-08 §2.1)', () => {
  it('one income colour and one expense colour exist, not three of each', () => {
    expect(cssVar.income).toBe(token.income);
    expect(rendered.income).toBe(token.income);
    expect(cssVar.expense).toBe(token.expense);
    expect(rendered.expense).toBe(token.expense);
  });

  it('income and expense text clear AA on both light surfaces', () => {
    for (const surface of SURFACES_LIGHT) {
      expect(ratio(token.income, surface)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratio(token.expense, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('the dark-mode pair clears AA on the gray-900 page AND the gray-800 cards', () => {
    for (const surface of SURFACES_DARK) {
      expect(ratio(rendered.darkIncome, surface)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratio(rendered.darkExpense, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('gold is never text without the darkened accent-text', () => {
    // The decorative gold itself measures ~2.2:1 — that is WHY accent-text
    // exists. The doc's first proposal (#a37d1e) measured 3.81:1 here and was
    // corrected; whatever value ships must actually pass.
    for (const surface of SURFACES_LIGHT) {
      expect(ratio(token.accentText, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('income-fill stays a chart colour: graphics contrast only', () => {
    // 3:1 is the WCAG 1.4.11 bar for non-text. If someone promotes the fill
    // to a text token this stops being the right test — see §2.1.
    expect(ratio(token.incomeFill, '#ffffff')).toBeGreaterThanOrEqual(AA_GRAPHICS);
    expect(ratio(token.incomeFill, '#ffffff')).toBeLessThan(AA_TEXT);
  });

  /**
   * THE CHART SERIES PAIR (PHONE_CAPTURES_REVIEW_2026-08-13 §4).
   *
   * `#10B981`/`#EF4444` were a second definition of income and expense, hard
   * coded in five files. The series now read the token sheet, and these pin
   * the two things that made the old arrangement rot: that the pair agrees
   * with the tokens, and that it is measured at the bar it actually owes.
   *
   * A series colour differs from a text colour in one way that matters here:
   * it is ONE hex for both themes — recharts takes a colour, not a class, so
   * there is no `dark:` variant to fall back on. It therefore has to clear
   * 3:1 on the dark card as well, which is a test the text pairs never sit.
   */
  describe('the chart series pair', () => {
    const SURFACES_ALL = [...SURFACES_LIGHT, ...SURFACES_DARK] as const;

    it('agrees with the module the charts actually read', () => {
      // The tokens are the declaration; SEMANTIC_SERIES is the copy recharts
      // consumes. Same rule as income/expense across their three files — an
      // unchecked copy is how there came to be five chart palettes.
      expect(SEMANTIC_SERIES.income.toLowerCase()).toBe(token.incomeFill);
      expect(SEMANTIC_SERIES.expense.toLowerCase()).toBe(token.expenseFill);
    });

    it('clears the 3:1 graphics bar on every surface a chart is drawn on', () => {
      for (const surface of SURFACES_ALL) {
        expect(ratio(token.incomeFill, surface)).toBeGreaterThanOrEqual(AA_GRAPHICS);
        expect(ratio(token.expenseFill, surface)).toBeGreaterThanOrEqual(AA_GRAPHICS);
      }
    });

    it('is not text, and fails here if someone makes it text', () => {
      // Both sit under 4.5:1 on white BY DESIGN: they are the colours the
      // amounts retired for exactly that reason. An amount that wants green
      // wants `income`, which is measured against the text bar above.
      expect(ratio(token.incomeFill, '#ffffff')).toBeLessThan(AA_TEXT);
      expect(ratio(token.expenseFill, '#ffffff')).toBeLessThan(AA_TEXT);
    });

    it('is not the same colour as the amounts, and not the old hard-coded pair', () => {
      expect(token.incomeFill).not.toBe(token.income);
      expect(token.expenseFill).not.toBe(token.expense);
      expect([token.incomeFill, token.expenseFill]).not.toContain('#10b981');
      expect([token.incomeFill, token.expenseFill]).not.toContain('#ef4444');
    });

    it('keeps green and red out of the categorical ramp (RULINGS §2)', () => {
      // The ramp is navy through slate. If a semantic hue ever appears in it,
      // a pie slice starts claiming to be income.
      for (const step of CATEGORICAL_AXIS) {
        expect(step.toLowerCase()).not.toBe(token.incomeFill);
        expect(step.toLowerCase()).not.toBe(token.expenseFill);
      }
    });
  });

  it('tabular figures are the app-wide default (P5)', () => {
    expect(indexCss).toMatch(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });
});
