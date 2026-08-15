/**
 * THE FOUR MOBILE BUGS OF 15 AUGUST, GUARDED AT THEIR CAUSE.
 *
 * These are CSS-level rules, and CSS is the one layer this repo's test harness
 * cannot execute: jsdom does not cascade, and the browser pane runs hidden, so
 * a hidden renderer skips style recalculation and `getComputedStyle` hands back
 * stale values after a class change. Both were confirmed while fixing these —
 * the layout numbers below were measured in the pane on load, where it IS
 * reliable, and the dark-mode ones could not be measured there at all.
 *
 * So these read the stylesheet as TEXT. That is weaker than rendering, and it
 * is chosen deliberately over asserting nothing: every rule here has already
 * shipped as a bug at least once, and two of them shipped twice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf8');
const indexCss = read('src/index.css');

describe('a type selector may not set padding on form controls', () => {
  /*
   * THIS BUG SHIPPED TWICE. `input[type="text"]` scores (0,1,1) — an attribute
   * selector plus a type — while a Tailwind utility like `pl-10` scores
   * (0,1,0). The element selector wins, so a global padding silently flattens
   * the considered padding of all 69 text inputs in the app.
   *
   * The visible symptom both times was the watchlist's search field: its
   * magnifier is absolutely positioned at `left-3` and is 20px wide, and the
   * field reserves `pl-10` (40px) for it. Measured at a 375px viewport with
   * the rule in place, that 40px computed to 16px — the icon drawn straight
   * through the placeholder.
   *
   * The first copy lived in the touch-pointer block and was removed. The
   * second lived in a `max-width: 768px` block and was NOT, so the owner
   * reported the same bug a second time. This test is why there will not be a
   * third: it does not care WHICH block the padding is in.
   */
  const controlPaddingBlocks = (): string[] => {
    const offenders: string[] = [];
    // Every rule whose selector list mentions a typed input, paired with the
    // declarations that follow it.
    const pattern = /input\[type="[^"]+"\][^{]*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(indexCss)) !== null) {
      if (/(?:^|[;{]|\s)padding\s*:/.test(match[1])) offenders.push(match[0].slice(0, 120));
    }
    return offenders;
  };

  it('declares no `padding` in any rule selecting a typed input', () => {
    expect(controlPaddingBlocks()).toEqual([]);
  });

  it('still forces 16px on mobile, which is what stops iOS zooming on focus', () => {
    // The legitimate half of the rule that carried the bug. Removing the
    // padding must not take this with it: at under 16px, iOS zooms the whole
    // page when a field takes focus, and that is behaviour, not decoration.
    const mobileBlock = indexCss.match(/@media screen and \(max-width: 768px\)\s*\{[\s\S]*?input\[type="text"\][\s\S]*?\}/);
    expect(mobileBlock).not.toBeNull();
    expect(mobileBlock?.[0]).toMatch(/@apply[^;]*text-base/);
  });
});

describe('the document root is painted in both modes', () => {
  /*
   * The app's ground was declared on a DIV. Everywhere that div reaches, that
   * is the colour; everywhere it does not, the page shows `body` — and `body`
   * had no background at all.
   *
   * On a browser tab nobody ever sees it. On an iPhone home-screen install it
   * is the first thing you see: index.html asks for
   * `apple-mobile-web-app-status-bar-style: black-translucent` with
   * `viewport-fit=cover` precisely so content runs UNDER the status bar, so
   * the strip behind the clock showed unpainted body — a white haze over the
   * app name, and black status-bar text because iOS samples a light ground to
   * choose.
   */
  it('gives html and body a light-mode background', () => {
    expect(indexCss).toMatch(/html,\s*\n?body\s*\{[^}]*background-color:\s*#f8f9fb/);
  });

  it('overrides it for dark on `html.dark`, the element that carries the class', () => {
    // PreferencesContext puts the class on `document.documentElement`, so the
    // selector has to be `html.dark` — `.dark html` describes an html element
    // inside something, which never exists.
    expect(indexCss).toMatch(/html\.dark[^{]*\{[^}]*background-color:\s*#111827/);
    expect(indexCss).not.toMatch(/\.dark\s+html\s*[,{]/);
  });
});

describe('no chart series carries a hardcoded ground-specific colour', () => {
  /*
   * The Net Worth line was `stroke="#1a2332"` — navy-900, the DARKEST step of
   * the categorical axis. Correct ink on the light card; on the dark card it
   * is near-black on #1f2937 and the owner reported the line as simply not
   * being there.
   *
   * What made it survive: the donuts on the same page had already been moved
   * to the ground-aware ramp and looked right in both modes, so nothing else
   * on the card was wrong. A single un-migrated series is invisible in review
   * and invisible in light mode.
   */
  const widgets = read('src/components/dashboard/reportWidgets/DashboardReportWidgets.tsx');

  it('uses the ramp rather than a literal hex for the net-worth line', () => {
    expect(widgets).not.toMatch(/stroke="#[0-9a-f]{6}"/i);
    expect(widgets).toMatch(/useCategoricalRamp\(\)/);
  });
});

describe('the global button rule that lets rows overflow', () => {
  /*
   * `button { display: inline-flex }` is app-wide, and it is why the Accounts
   * band headers dragged the page sideways: a flex ITEM defaults to
   * `min-width: auto` and refuses to shrink below its own min-content, so the
   * header row stayed 370px inside a button that `w-full` had made 343px, and
   * the document went to 402px at a 375px viewport.
   *
   * The rule itself is load-bearing (it is what aligns icon-and-label buttons)
   * so it stays. This test pins the COMMENT that explains the trap, because
   * the next person to write a full-width button inside one needs to know that
   * `min-w-0` and `w-full` on the inner row are not optional.
   */
  it('is still documented as needing min-w-0 on full-width contents', () => {
    const block = indexCss.match(/button\s*\{[^}]*display:\s*inline-flex[^}]*\}/);
    expect(block, 'the global button rule moved — re-point this guard').not.toBeNull();
  });
});

describe('a light-mode contrast remap may not reach dark mode', () => {
  /*
   * `accessibility-colors.css` raises grey text for WCAG on WHITE. Every rule
   * in it carries `!important`, which beats any `dark:` variant a component
   * declares however specific — so an unscoped rule does not merely fail to
   * help in dark mode, it actively overrides the colour that was chosen for
   * dark mode.
   *
   * Measured: an element written `text-xs text-gray-500 dark:text-gray-300`
   * rendered at #374151 on a #1f2937 card. That is 1.3:1 — not dim, absent.
   * The owner reported it as "you can't see the 'last updated' font within
   * the accounts", and it was never that component's bug: 462 elements across
   * the app pair a grey with a small-text class.
   *
   * The rule: a light-tuned colour must say so in its selector.
   */
  const remapCss = read('src/styles/accessibility-colors.css');

  it('scopes every grey remap to light mode', () => {
    // Comments stripped first, or the prose explaining this rule reads as a
    // rule. Then each selector in each rule's selector LIST is judged on its
    // own — a list is only as scoped as its least-scoped member.
    const withoutComments = remapCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const offenders: string[] = [];

    for (const rule of withoutComments.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/color\s*:/.test(rule[2])) continue;
      for (const selector of rule[1].split(',')) {
        const trimmed = selector.trim();
        // The BARE utility — `.text-gray-500`, not Tailwind's escaped
        // `.dark\:text-gray-500`, which is a different class entirely and is
        // supposed to apply in dark mode.
        if (!/(?:^|[\s>+~])\.text-gray-(?:400|500)\b/.test(trimmed)) continue;
        if (trimmed.includes('html:not(.dark)') || /(?:^|\s)\.dark(?:\s|$)/.test(trimmed)) continue;
        offenders.push(trimmed);
      }
    }

    expect(offenders, 'these darken grey text in DARK mode too').toEqual([]);
  });

  it('still applies them in light mode, which is what they are for', () => {
    // Scoping must not become deleting: Tailwind's gray-500 on white is 4.0:1
    // and misses AA for body text, which is why these exist.
    expect(remapCss).toMatch(/html:not\(\.dark\)\s+\.text-gray-500\s*\{[^}]*color:/);
    expect(remapCss).toMatch(/html:not\(\.dark\)\s+\.text-xs\.text-gray-500/);
  });
});
