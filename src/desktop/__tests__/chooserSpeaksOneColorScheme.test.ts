import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE CHOOSER SPEAKS THE SAME DARK-MODE LANGUAGE AS THE GROUND IT SITS ON.
 *
 * Two mechanisms exist: `color-scheme` (the PLATFORM decides, and with it the
 * UA's default ink) and the app's `html.dark` class (a PREFERENCE, stored in
 * the ledger file). The desktop window loads index.css, whose ground is
 * class-based — light until `html.dark` — while nothing before a ledger opens
 * can set that class. So a `color-scheme` that lets the platform choose dark
 * puts the UA's white default ink on the app's light ground: white-on-white,
 * which is how the owner's first Windows run read as "just a white screen"
 * (25 Aug 2026) while every element was in fact rendered and clickable.
 *
 * jsdom computes no UA colours, so this pins the SOURCE: the declaration must
 * commit to the state the ground is actually in.
 */
describe('the desktop window declares one colour scheme', () => {
  it('desktop.css pins color-scheme to light, matching the unclassed ground', () => {
    // Comments stripped FIRST — the file's own comment explains this very
    // rule and would otherwise satisfy or trip the match. Third instance of
    // that census hole today; see buttonsStackTheirOwnRows and the
    // touch-target census, which both had to close it.
    const css = readFileSync(join(process.cwd(), 'src/desktop/desktop.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    const declarations = css.match(/color-scheme\s*:\s*([^;]+);/g) ?? [];
    expect(declarations, 'the chooser must declare a colour scheme').not.toHaveLength(0);
    for (const declaration of declarations) {
      expect(
        declaration,
        'a platform-decides colour scheme reintroduces white-on-white on any ' +
        'dark-mode OS — the ground under this window is class-based and light ' +
        'until a ledger opens'
      ).not.toMatch(/light\s+dark|dark\s+light|\bnormal\b/);
    }
  });
});
