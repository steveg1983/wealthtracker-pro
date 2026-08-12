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
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ColorContrastChecker } from '../../utils/color-contrast-checker';

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

  it('tabular figures are the app-wide default (P5)', () => {
    expect(indexCss).toMatch(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });
});
