/**
 * THE MARK IS A LETTER AND TWO LINES, AND IT STAYS THAT.
 *
 * The identity handover (16 Sep 2026) named the things that would quietly go
 * wrong with this mark, in the order they would happen: the R left as live
 * text, so a missing webfont swaps the letter for another face; the second
 * rule "simplified" away, which turns "checked and final" into "subtotal"; a
 * second hue, or worse the amber, borrowed for a logo; and a squash. Each has
 * a test here, and each test measures the files rather than remembering them.
 *
 * The first test is the one that keeps the rest honest: it reruns the
 * generator against the committed font and spec, so an asset edited by hand —
 * or a spec number changed without regenerating — fails here, not in review.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAVY, LOCKUP_HORIZONTAL, LOCKUP_STACKED, MARK_R_PATH, MARK_RULES } from '../brandIdentity';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const BRAND_SVGS = [
  'public/brand/reckley-mark.svg',
  'public/brand/reckley-lockup-horizontal.svg',
  'public/brand/reckley-lockup-stacked.svg',
  'public/favicon.svg'
];

/** The boot splash's lockup, as the page shell carries it. */
const bootLockup = (): string => {
  const html = read('index.html');
  const match = html.match(/<!-- brand:boot-lockup[^>]*-->\s*(<svg[\s\S]*?<\/svg>)\s*<!-- \/brand:boot-lockup -->/);
  if (!match) throw new Error('index.html has lost its brand:boot-lockup block');
  return match[1];
};

describe('the outlined identity', () => {
  it('is exactly what the generator makes from the font and the spec', () => {
    const out = execFileSync(process.execPath, ['scripts/brand/build-identity.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    expect(out).toContain('every vector asset matches the font and the spec');
  });

  it('draws the mark as one path and two rects — no live text, no font, no decoration', () => {
    const svg = read('public/brand/reckley-mark.svg');
    const elements = [...svg.matchAll(/<([a-zA-Z][\w:-]*)/g)].map((m) => m[1]);
    expect(elements).toEqual(['svg', 'path', 'rect', 'rect']);
    for (const banned of ['<text', 'font-family', '<defs', 'Gradient', 'class=', 'filter']) {
      expect(svg).not.toContain(banned);
    }
    // No width/height on the root: CSS sizes it (handover §3).
    const root = svg.match(/<svg[^>]*>/)?.[0] ?? '';
    expect(root).not.toMatch(/\s(width|height)=/);
    expect(root).toContain('viewBox="0 0 48 48"');
    expect(root).toContain('fill="currentColor"');
  });

  it('never carries a glyph that a missing font could swap — in any brand file', () => {
    for (const svg of [...BRAND_SVGS.map(read), bootLockup()]) {
      expect(svg).not.toMatch(/<text|font-family|<tspan/);
    }
    expect(MARK_R_PATH).toMatch(/^M[\d. ]+/);
  });

  it('keeps two rules, always: the same bar twice, 2.4 apart', () => {
    expect(MARK_RULES).toHaveLength(2);
    const [first, second] = MARK_RULES;
    expect(second.x).toBe(first.x);
    expect(second.width).toBe(first.width);
    expect(second.height).toBe(first.height);
    expect(second.y - (first.y + first.height)).toBeCloseTo(2.4, 5);
    // And every file that draws the mark draws both.
    for (const svg of [...BRAND_SVGS.map(read), bootLockup()]) {
      expect(svg.match(/<rect/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('paints one colour — never the amber, the income green or the expense red', () => {
    const allowed = new Set(['currentColor', BRAND_NAVY, '#ffffff']);
    for (const svg of [...BRAND_SVGS.map(read), bootLockup()]) {
      for (const [, colour] of svg.matchAll(/fill="([^"]+)"/g)) {
        expect(allowed, `${colour} is not a brand colour`).toContain(colour);
      }
      expect(svg).not.toMatch(/stroke=|opacity/);
    }
  });

  it('cannot be squashed: preserveAspectRatio is never none, and the lockups keep their own aspect', () => {
    const lockupSource = read('src/components/brand/ReckleyLockup.tsx');
    for (const text of [...BRAND_SVGS.map(read), bootLockup(), lockupSource]) {
      expect(text).not.toMatch(/preserveAspectRatio\s*=\s*["{]\s*['"]?none/);
    }
    for (const { viewBox } of [LOCKUP_HORIZONTAL, LOCKUP_STACKED]) {
      expect(viewBox.width).toBeGreaterThan(0);
      expect(viewBox.height).toBeGreaterThan(0);
    }
    const [, , w, h] = bootLockup()
      .match(/viewBox="([^"]+)"/)![1]
      .split(' ')
      .map(Number);
    const width = Number(bootLockup().match(/ width="([\d.]+)"/)![1]);
    const height = Number(bootLockup().match(/ height="([\d.]+)"/)![1]);
    expect(width / height).toBeCloseTo(w / h, 2);
  });
});
