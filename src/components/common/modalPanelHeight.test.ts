/**
 * A dialog is never taller than the screen it is being read on.
 *
 * ─ THE FAILURE THIS EXISTS TO CATCH ────────────────────────────────────────
 * The panel's height cap was written as two Tailwind arbitrary utilities on
 * one element:
 *
 *     max-h-[calc(100vh-5.5rem)]
 *     max-h-[calc(100dvh-5.5rem)]
 *
 * with a comment explaining that the dvh line came second "deliberately", so
 * that a browser without `dvh` would fall back to `vh`. That is the correct
 * idiom for two DECLARATIONS. These are not two declarations. They are two
 * rules of equal specificity, and which one wins is settled by the order
 * Tailwind emits them into the stylesheet — where arbitrary values are sorted
 * as text, and "100dvh" sorts before "100vh". Measured in the built CSS on
 * 29 Aug: the dvh rule at byte 17638, the vh rule at 17711. The vh rule came
 * last and won, every time, on every device.
 *
 * On iOS `100vh` is the LARGE viewport — the height the page would have if the
 * browser's chrome were retracted — so the dialog ran past the bottom of the
 * glass while the page behind it was scroll-locked and could not be scrolled
 * to reach it. The owner met it twice on his phone, three days apart, as an
 * Edit Transaction sheet whose footer showed only "Delete" and then showed
 * nothing at all. Nothing else could see it: the class was present, the
 * comment was right about what it wanted, the types were fine, and Chromium
 * resolves `vh` and `dvh` to the same number so no desktop check could
 * disagree.
 *
 * ─ WHAT IS ASSERTED ────────────────────────────────────────────────────────
 * That the cap lives in ONE rule, where the last declaration genuinely is the
 * last word, and that the component has not gone back to stacking utilities.
 * The middle test is what keeps the other two from being decoration: it
 * compiles the stacked idiom and shows it really does produce two independent
 * rules, so "written second" is not a thing the class list can express.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Compile the app's real stylesheet against a probe naming the panel's classes. */
function compile(probeClasses: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'wt-modal-height-'));
  try {
    const probe = join(dir, 'probe.tsx');
    writeFileSync(probe, `export const P = () => <div className="${probeClasses}" />;\n`);
    const out = join(dir, 'probe.css');
    execFileSync(
      'npx',
      ['tailwindcss', '-c', 'tailwind.config.js', '-i', 'src/index.css', '--content', probe, '-o', out],
      { cwd: process.cwd(), stdio: 'pipe' }
    );
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('the modal panel is capped by the height a reader can actually see', () => {
  it('caps the panel in one rule whose last word is dvh', () => {
    const css = compile('modal-panel');
    const rule = /\.modal-panel\s*\{([^}]*)\}/.exec(css);
    expect(rule, '.modal-panel must survive compilation').not.toBeNull();

    const body = rule![1];
    const vh = body.indexOf('100vh');
    const dvh = body.indexOf('100dvh');

    // Both present: the vh line is the fallback for a browser that would throw
    // the dvh line away as invalid, and deleting it would strand those.
    expect(vh, 'the vh fallback must still be there').toBeGreaterThanOrEqual(0);
    expect(dvh, 'the dvh cap must still be there').toBeGreaterThanOrEqual(0);

    // And in that order, inside ONE block, which is the only place where
    // "written second" and "wins" mean the same thing.
    expect(dvh).toBeGreaterThan(vh);
  });

  it('shows why the cap cannot be two classes: they compile to separate rules', () => {
    // Not a claim about which of the two wins — Tailwind's sort order is its
    // own business and may change. The point is that there are two rules to
    // sort at all, so the element's class list has no say in the outcome.
    const css = compile('max-h-[calc(100vh-5.5rem)] max-h-[calc(100dvh-5.5rem)]');
    const rules = css.match(/\.max-h-\\\[calc\\\(100d?vh-5\\\.5rem\\\)\\\]\s*\{/g) ?? [];
    expect(rules).toHaveLength(2);
  });

  it('keeps the component out of the trap', () => {
    const source = readFileSync('src/components/common/Modal.tsx', 'utf8');
    expect(source).toContain('modal-panel');
    // Any `max-h-[…]` utility back on this panel is the old shape returning,
    // whether or not it is paired with a second one today.
    expect(source).not.toMatch(/max-h-\[/);
  });
});
