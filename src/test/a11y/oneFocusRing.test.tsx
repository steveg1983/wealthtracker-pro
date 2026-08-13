/**
 * Exactly ONE focus indicator is drawn — RULINGS_ON_CAUSE_2026-08-13 §3.
 *
 * The app declares its focus ring once, globally, in accessibility-colors.css:
 *
 *     *:focus-visible { outline: 2px solid var(--focus-ring-color) !important }
 *
 * Because of the `!important`, a component that ALSO asked for a Tailwind
 * `focus-visible:ring-*` got BOTH — its own ring, and 2px further out the
 * global outline, with its `focus:outline-none` powerless to stop it. About
 * 200 utilities across 74 files were doing this, in six different colours, and
 * one component (AccountRowColumns) had already found the bug and worked around
 * it locally. That is what this file exists to keep from coming back.
 *
 * ─ WHY IT IS SHAPED LIKE THIS ──────────────────────────────────────────────
 * Claude Design asked for the RENDERED treatment to be asserted, not "each
 * component sets a ring" — the latter is what let six rings coexist. jsdom
 * cannot answer that question directly: it does not match `:focus-visible`,
 * and it does not implement the `!important` cascade across linked
 * stylesheets, so `getComputedStyle` on a focused node reports nothing useful
 * (see accessibility-testing.ts, which is unwired for exactly this reason).
 *
 * So "exactly one" is proven as one plus zero, from the two sources that
 * actually decide it:
 *   ONE  — the global rule is present, carries !important, and nothing
 *          outranks it (the `button.rounded-full` outline-kill did, and had to
 *          be removed for this to be true).
 *   ZERO — no shipped control carries a focus-ring utility of its own. Checked
 *          against the real rendered className of a sample of controls, and
 *          then against every source file so a new one cannot slip in.
 * Both halves measured, in the idiom of semantic-contrast.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import React from 'react';
import { ColorContrastChecker } from '../../utils/color-contrast-checker';
import { Button } from '../../components/common/Button';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import {
  ACCOUNT_ROW_NAME_LINK_CLASS,
  ACCOUNT_ROW_SELECTED_CLASS,
} from '../../components/AccountRowColumns';

const read = (repoPath: string): string =>
  readFileSync(resolve(process.cwd(), repoPath), 'utf8');

const remapCss = read('src/styles/accessibility-colors.css');
const indexCss = read('src/index.css');

/** Any component-declared focus ring. `focus-within:` is deliberately absent. */
const FOCUS_RING = /(?:dark:)?(?:group-)?focus(?:-visible)?:ring/;
const FOCUS_OUTLINE_NONE = /(?:dark:)?focus(?:-visible)?:outline-none/;

const AA_GRAPHICS = 3.0;
const SURFACES_LIGHT = ['#ffffff', '#f8f9fb'] as const;
const SURFACES_DARK = ['#111827', '#1f2937'] as const;

function extract(source: string, pattern: RegExp, where: string): string {
  const match = source.match(pattern);
  if (match === null) throw new Error(`Not found: ${where} — has the declaration moved?`);
  return match[1].toLowerCase();
}

describe('ONE — the app draws a focus ring', () => {
  it('declares the global focus outline with !important, so it always paints', () => {
    expect(remapCss).toMatch(
      /\*:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring-color[^)]*\)\s*!important/
    );
  });

  it('lets nothing outrank it: no rule kills an outline on focus-visible', () => {
    // `button.rounded-full:focus-visible { outline: none !important }` used to
    // live in index.css. It beat the global rule on specificity AND carried
    // !important, so every circular button in the app — the toggle switches,
    // the icon buttons — had no focus indicator whatsoever, and the repair
    // written for it in borders.css could never win.
    // Comments come out first — this very file explains the bug in prose that
    // would otherwise read as a rule declaring it.
    const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [name, css] of [['index.css', indexCss], ['accessibility-colors.css', remapCss]] as const) {
      const offenders = withoutComments(css)
        .split('}')
        .filter(block => /outline:\s*none\s*!important/.test(block) && /:focus-visible/.test(block))
        .map(block => block.trim().split('\n')[0]);
      expect(offenders, `${name} kills the focus outline: ${offenders.join(' | ')}`).toEqual([]);
    }
  });

  it('is visible on the grounds it is drawn against, measured', () => {
    // The ring sits at outline-offset 2px, so it lands on the surface BEHIND
    // the control — which is why a red destructive button needs no override
    // and a control inside a navy panel does.
    const light = extract(indexCss, /--focus-ring-color:\s*(#[0-9a-f]{6})/i, 'light --focus-ring-color');
    const dark = extract(indexCss, /\.dark\s*\{[\s\S]*?--focus-ring-color:\s*(#[0-9a-f]{6})/i, 'dark --focus-ring-color');

    for (const surface of SURFACES_LIGHT) {
      const ratio = ColorContrastChecker.getContrastRatio(light, surface);
      expect(ratio, `${light} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_GRAPHICS);
    }
    for (const surface of SURFACES_DARK) {
      const ratio = ColorContrastChecker.getContrastRatio(dark, surface);
      expect(ratio, `${dark} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_GRAPHICS);
    }
  });

  it('changes COLOUR, not count, where the ground is navy', () => {
    const scoped = extract(remapCss, /\.focus-ring-on-dark\s*\{\s*--focus-ring-color:\s*(#[0-9a-f]{6})/i, '.focus-ring-on-dark');
    for (const navy of ['#1a2332', '#2d3a4d', '#1f2937']) {
      const ratio = ColorContrastChecker.getContrastRatio(scoped, navy);
      expect(ratio, `${scoped} on ${navy} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_GRAPHICS);
    }
  });
});

describe('ZERO — no control adds a second one', () => {
  it.each([
    ['primary button', <Button key="p">Save</Button>],
    ['secondary button', <Button key="s" variant="secondary">Cancel</Button>],
    ['destructive button', <Button key="d" variant="danger">Delete</Button>],
    ['toggle switch', <ToggleSwitch key="t" checked={false} onChange={() => {}} aria-label="Toggle" />],
  ])('%s renders with no focus ring of its own', (_name, element) => {
    const { container, unmount } = render(element);
    // Every element, not just the root: the toggle's ring used to live on an
    // inner span via `group-focus-visible:`.
    for (const node of Array.from(container.querySelectorAll('*'))) {
      const className = node.getAttribute('class') ?? '';
      expect(className, `${_name} → ${className}`).not.toMatch(FOCUS_RING);
      expect(className, `${_name} → ${className}`).not.toMatch(FOCUS_OUTLINE_NONE);
    }
    unmount();
  });

  it('a link and a text input render with no focus ring of their own', () => {
    render(
      <div>
        <a href="/accounts" className={ACCOUNT_ROW_NAME_LINK_CLASS}>Everyday</a>
        <input type="text" aria-label="Amount" />
      </div>
    );
    expect(screen.getByRole('link').className).not.toMatch(FOCUS_RING);
    expect(screen.getByRole('link').className).not.toMatch(FOCUS_OUTLINE_NONE);
    expect(screen.getByRole('textbox').className).not.toMatch(FOCUS_RING);
  });

  it('the selected row keeps its SELECTION ring and suppresses it only while focused', () => {
    // The one `focus-visible:ring-0` left in the app. It is not fighting a
    // focus ring — it stands the `ring-1` selection indicator down so a
    // selected, arrowed-to row wears one stroke rather than two. §6 law keeps
    // the selection ring; removing this would bring the double border back.
    expect(ACCOUNT_ROW_SELECTED_CLASS).toContain('ring-1');
    expect(ACCOUNT_ROW_SELECTED_CLASS).toContain('focus-visible:ring-0');
  });
});

describe('ZERO — and it stays zero', () => {
  const SOURCE_ROOT = 'src';
  /** The row's documented `ring-0`, which suppresses a SELECTION ring. */
  const ALLOWED = new Map([['src/components/AccountRowColumns.tsx', 1]]);

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(resolve(process.cwd(), dir))) {
      const rel = join(dir, entry);
      if (statSync(resolve(process.cwd(), rel)).isDirectory()) {
        out.push(...sourceFiles(rel));
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(rel);
      }
    }
    return out;
  }

  it('no component in src/ declares a focus ring', () => {
    const stripped = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const offenders: string[] = [];

    for (const file of sourceFiles(SOURCE_ROOT)) {
      const hits = stripped(read(file)).match(/(?:dark:)?(?:group-)?focus(?:-visible)?:ring[\w[\]#./-]*/g) ?? [];
      const allowed = ALLOWED.get(file) ?? 0;
      if (hits.length > allowed) offenders.push(`${file}: ${hits.join(' ')}`);
    }

    expect(offenders, `a second focus ring is back:\n${offenders.join('\n')}`).toEqual([]);
  });
});
