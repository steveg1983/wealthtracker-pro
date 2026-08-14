/**
 * The offsets that say where the top of the window has already been spent.
 *
 * Two things went wrong on 2026-08-14 while the accounts page learned to park
 * its toolbar, and neither was caught by lint or by `typecheck:strict`. This
 * file is the guard for both, because both fail SILENTLY — the app builds, the
 * types are sound, and a control the owner asked to keep reachable sits behind
 * the nav bar.
 *
 *   1. The offset written as literals. `top-16 md:top-12` looks like the
 *      obvious thing to copy and is wrong three ways: it omits the demo
 *      banner, it omits the status-bar inset an installed home-screen app has,
 *      and its mobile figure (64px) is not even the height of the mobile
 *      header (76px, measured).
 *   2. The constants living in `Layout.tsx`. A page importing back from Layout
 *      closes a module cycle, and the page died with `ReferenceError:
 *      STICKY_UNDER_APP_BAR is not defined`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP_BAR_HEIGHT_VAR,
  DEMO_BANNER_OFFSET,
  SAFE_AREA_TOP,
  STICKY_UNDER_APP_BAR,
  TOP_CHROME_OFFSET
} from '../chromeOffsets';

describe('where a page may park its own chrome', () => {
  it('adds up all three things above it, rather than naming a number', () => {
    // Each term is a separate failure the owner would see: no inset and the
    // bar hides under the iPhone status bar on his home screen; no banner and
    // it hides under the nav in demo mode; no app-bar height and it hides
    // under the app bar always.
    expect(STICKY_UNDER_APP_BAR).toContain(SAFE_AREA_TOP);
    expect(STICKY_UNDER_APP_BAR).toContain(DEMO_BANNER_OFFSET);
    expect(STICKY_UNDER_APP_BAR).toContain(APP_BAR_HEIGHT_VAR);
    expect(STICKY_UNDER_APP_BAR.startsWith('calc(')).toBe(true);
  });

  it('leaves every term for the browser to resolve, so none can go stale', () => {
    // A pixel literal anywhere in here is the `calc(100vh-13rem)` mistake
    // again: a measurement of other people's markup, correct only on the day
    // it was written. `0px` fallbacks inside var()/env() are the exception —
    // they are what "absent" means, not a measurement.
    const withoutFallbacks = STICKY_UNDER_APP_BAR.replace(/,\s*0px/g, '');
    expect(withoutFallbacks).not.toMatch(/\d+px/);
    expect(withoutFallbacks).not.toMatch(/\d+rem/);
  });

  it('starts from the same base the app bars themselves use', () => {
    // If these two ever disagree, parked chrome and the bar it parks under are
    // measuring from different origins.
    expect(TOP_CHROME_OFFSET).toContain(SAFE_AREA_TOP);
    expect(TOP_CHROME_OFFSET).toContain(DEMO_BANNER_OFFSET);
  });
});

describe('the module itself', () => {
  it('is a leaf, so it cannot be half of an import cycle', () => {
    /*
     * THIS IS THE POINT OF THE FILE EXISTING. Layout renders the router's
     * Outlet, so every page is downstream of it; when these constants lived in
     * Layout and a page imported one back, ESM handed out the binding before
     * the module had evaluated it and the page died behind the error boundary.
     * Lint and strict TypeScript both passed on that — a cycle is legal in
     * both. Only loading the page found it.
     *
     * A module that imports nothing cannot participate in a cycle, so that is
     * what is asserted: no imports at all, not merely "no components".
     */
    const source = readFileSync(
      join(__dirname, '..', 'chromeOffsets.ts'),
      'utf8'
    );
    const imports = source
      .split('\n')
      .filter(line => /^\s*import\b/.test(line));

    expect(imports).toEqual([]);
  });
});
