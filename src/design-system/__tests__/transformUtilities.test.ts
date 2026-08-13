/**
 * A transform utility must arrive with the variables it is built from.
 *
 * ─ WHAT THIS GUARDS ────────────────────────────────────────────────────────
 * Tailwind does not emit `transform: rotate(90deg)`. `rotate-90` sets ONE
 * variable and then a composed declaration that reads SEVEN:
 *
 *   .rotate-90 { --tw-rotate: 90deg;
 *                transform: translate(var(--tw-translate-x), var(--tw-translate-y))
 *                           rotate(var(--tw-rotate)) skew(var(--tw-skew-x))
 *                           skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x))
 *                           scaleY(var(--tw-scale-y)) }
 *
 * The other six are initialised once, globally, by the base layer's
 * `*, ::before, ::after` block. If that block ever stops being emitted, every
 * one of those `var()`s is invalid, which makes the WHOLE `transform`
 * declaration invalid at computed-value time. The property falls back to
 * `none`, and every rotation, scale and translate in the app silently stops
 * working: no error, no warning, no failing type or lint, and the class still
 * sitting there in the markup.
 *
 * What removes it is dropping `@tailwind base` from `src/index.css`. Note that
 * `corePlugins: { preflight: false }` does NOT — measured while writing this,
 * because the falsification case below was originally written that way and
 * passed when it should have failed. Tailwind emits the variable defaults from
 * a separate plugin to the preflight reset, so switching preflight off costs
 * the resets and keeps the transforms. Worth knowing before anyone "fixes"
 * transforms by turning preflight back on.
 *
 * Same family as `tokenOpacity` — a class that is present and inert.
 *
 * ─ WHAT THIS IS *NOT* ──────────────────────────────────────────────────────
 * It is not a claim about what any element looks like, and deliberately so.
 * This guard was written after a report that `rotate-90` computed to the
 * identity matrix on live chevrons. It did not: the reading was taken in an
 * automated browser tab, where `document.visibilityState === 'hidden'` and CSS
 * transitions therefore never advance. Measured 2026-08-13: a 100ms
 * `transition-transform` had not completed after 1991ms, and mid-flight
 * `getComputedStyle().transform` reads `matrix(1, 0, 0, 1, 0, 0)` — the
 * identity matrix, and the exact figure that was reported as the bug. With
 * `transition: none` the same element toggles correctly between
 * `matrix(0, 1, -1, 0, 0, 0)` and `none`.
 *
 * So: never conclude anything about a TRANSITIONED property from a computed
 * style read in a headless or background tab. Disable the transition first, or
 * assert the class and the variable rather than the matrix. That trap is why
 * this file checks the stylesheet — which is true regardless of who is looking
 * at the page — instead of a rendered element.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The six variables `rotate-90`'s own declaration reads but does not set.
 * `--tw-rotate` is excluded: the utility sets that one itself.
 */
const INHERITED_TRANSFORM_VARS = [
  '--tw-translate-x',
  '--tw-translate-y',
  '--tw-skew-x',
  '--tw-skew-y',
  '--tw-scale-x',
  '--tw-scale-y',
] as const;

/** Utilities in real use across the app, one per transform family. */
const PROBE_CLASSES = ['rotate-90', 'rotate-180', '-rotate-90', 'scale-105', 'translate-x-0'];

/**
 * Compile the probe, optionally without the base layer.
 *
 * `withoutBaseLayer` exists so the test can prove itself: a guard that has
 * never been seen to fail is a guard nobody should trust.
 */
function compileProbe(options: { withoutBaseLayer?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'wt-transform-probe-'));
  try {
    const probe = join(dir, 'probe.tsx');
    writeFileSync(probe, `export const P = () => <div className="${PROBE_CLASSES.join(' ')}" />;\n`);

    const args = ['tailwindcss', '-c', 'tailwind.config.js', '--content', probe];
    if (options.withoutBaseLayer === true) {
      // The realistic sabotage: an entry stylesheet that forgets `@tailwind
      // base`. Everything still compiles and every utility is still emitted.
      const input = join(dir, 'no-base.css');
      writeFileSync(input, '@tailwind components;\n@tailwind utilities;\n');
      args.push('-i', input);
    }

    const out = join(dir, 'probe.css');
    execFileSync('npx', [...args, '-o', out], { cwd: process.cwd(), stdio: 'pipe' });
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Does the sheet initialise `name` on a universal selector? */
function initialisedGlobally(css: string, name: string): boolean {
  return new RegExp(
    String.raw`\*\s*,[^{}]*\{[^{}]*${name}\s*:`,
    's'
  ).test(css);
}

describe('transform utilities compile to something that can actually transform', () => {
  const css = compileProbe();

  it('emits the rotate utility at all', () => {
    expect(css).toMatch(/\.rotate-90\s*\{[^}]*--tw-rotate:\s*90deg/);
    expect(css).toMatch(/\.rotate-90\s*\{[^}]*transform:/);
  });

  it('initialises every variable that the rotate declaration reads', () => {
    // The whole point: `rotate-90` reads six variables it never sets, and one
    // missing one invalidates the entire declaration — not just its own term.
    for (const name of INHERITED_TRANSFORM_VARS) {
      expect(
        initialisedGlobally(css, name),
        `${name} is read by .rotate-90 but never initialised globally — every transform in the app is now inert`
      ).toBe(true);
    }
  });

  it('fails when the base layer is dropped (this guard can fail)', () => {
    // Non-vacuity, proven rather than asserted — and note what survives: the
    // utility is still emitted, correct and complete. That is the whole danger.
    // The class looks right in the markup, right in the stylesheet, and does
    // nothing on screen.
    const withoutBase = compileProbe({ withoutBaseLayer: true });

    expect(withoutBase).toMatch(/\.rotate-90\s*\{[^}]*--tw-rotate:\s*90deg/);
    for (const name of INHERITED_TRANSFORM_VARS) {
      expect(initialisedGlobally(withoutBase, name)).toBe(false);
    }
  });
});
