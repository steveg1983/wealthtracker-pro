/**
 * THREE WAYS TO WRITE A COLOUR THAT ISN'T THERE.
 *
 * All three shipped, all three were invisible only in dark mode, and none of
 * them is a typo a reviewer would catch by reading — each looks exactly like
 * working code. They were found by the owner opening Settings, which is not a
 * test strategy.
 *
 * 1. A `!important` utility with no dark variant. `.text-theme-heading` set
 *    `color: var(--color-secondary) !important` — navy — and because of the
 *    `!important` it also beat the `dark:text-white` that most call sites had
 *    written beside it. 27 section headings, navy on near-black.
 *
 * 2. A class that does not exist. `dark:bg-gray-800-sm` is not a Tailwind
 *    class, so it emitted nothing and the input kept its light `bg-white`
 *    while its text obeyed `dark:text-white`. White on white, in 39 places.
 *    The name is plausible enough to survive review indefinitely.
 *
 * 3. An opacity on a bare `var()`. `bg-primary/20` emits no CSS, because
 *    Tailwind cannot compose an alpha with a variable it cannot parse.
 *
 * What unites them: **a colour that fails to apply looks like a colour that
 * was never asked for.** Nothing errors, nothing warns, and the element simply
 * inherits. So these are grep tests over source rather than render tests —
 * the failure is upstream of rendering.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC);
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8');
const TAILWIND_CONFIG = readFileSync(join(process.cwd(), 'tailwind.config.js'), 'utf8');

/**
 * How a colour token is DECLARED in `tailwind.config.js`, or `null` if there is
 * no such top-level colour.
 *
 * Read as text, the way `semantic-contrast.test.ts` reads the same file two
 * directories over: an instrument that parses the same characters the build
 * parses cannot drift from it, and a `.js` config has no types to import.
 *
 * ANCHORED ON THE INDENT, and that is the fiddly part worth stating. The colour
 * map's own entries sit at eight spaces (`primary:`, `secondary:`); the nested
 * groups' entries sit deeper (`surface.tertiary:` at ten). Matching anywhere
 * would let `surface`'s `tertiary` answer for a top-level `tertiary` that does
 * not exist — a wrong reading that happens to give the right verdict today, and
 * would give the wrong one the moment `surface.tertiary` changed shape. The
 * non-vacuity test below fails if a reformat moves the map.
 */
function tokenDeclaration(token: string): string | null {
  const match = TAILWIND_CONFIG.match(new RegExp(`^ {8}'?${token}'?:\\s*(.+?),\\s*$`, 'm'));
  return match === null ? null : match[1];
}

/** Can `bg-${token}/50` compose an alpha, or does it emit nothing at all? */
function carriesAlpha(token: string): boolean {
  const declaration = tokenDeclaration(token);
  return declaration !== null && declaration.includes('<alpha-value>');
}

/** The tokens this file's opacity rule was written about. */
const ALPHA_CANDIDATES = ['primary', 'secondary', 'tertiary'] as const;

/**
 * Comments blanked, line numbers preserved.
 *
 * This repository documents its traps by NAMING them, so `bg-primary/20`
 * appears in prose more often than in code — including in the comment that
 * explains this very rule. A line-by-line "starts with //" filter is not
 * enough: it misses the continuation lines of a block comment, which was this
 * test's own first false positive.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead: string) => lead + ' '.repeat(match.length - lead.length));
}

/** `path:line — the offending text`, so a failure is actionable without a hunt. */
function findInSource(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of FILES) {
    if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file.replace(SRC, 'src')}:${i + 1} — ${line.trim().slice(0, 90)}`);
    });
  }
  return hits;
}

describe('dark-mode colours that silently do not apply', () => {
  it('has no Tailwind class ending in a size suffix that does not exist', () => {
    // `bg-gray-800-sm`, `text-gray-700-md` and friends. A background has no
    // size, so any such class is a paste artefact that emits nothing.
    const hits = findInSource(/\b(?:dark:)?(?:bg|text|border)-\w+-\d{2,3}-(?:sm|md|lg|xl)\b/);
    expect(hits, `These classes emit no CSS:\n${hits.join('\n')}`).toEqual([]);
  });

  it('can still find the colour map it reads the alpha rule out of', () => {
    // Non-vacuity for the assertion below, and the reason it is a test of its
    // own: the indent anchor in `tokenDeclaration` is the fragile part, and if
    // a reformat moved the map every token would read as "declares no
    // <alpha-value>" and the ban would silently widen to cover the tokens the
    // app now depends on. A guard that derives its own rule has to prove it
    // can still read the source of it.
    expect(tokenDeclaration('primary')).toContain('<alpha-value>');
    expect(tokenDeclaration('secondary')).toContain('<alpha-value>');
    // …and one that genuinely is not a top-level colour, so the filter has
    // something to catch and the alternation is never empty.
    expect(tokenDeclaration('tertiary')).toBeNull();
  });

  it('never puts an opacity on a token that cannot carry one', () => {
    // `bg-primary/20`, `text-primary/70`. Tailwind cannot compose an alpha with
    // a bare `var(--x)`, so the whole declaration is dropped.
    //
    // WHICH TOKENS THOSE ARE IS READ, NOT REMEMBERED — updated 29 Aug 2026, and
    // the reason for the change is the whole point of writing it this way. This
    // assertion used to name `primary|secondary|tertiary` as a fixed list, and
    // by the time the stock-blue sweep needed `bg-primary/10` for a selected
    // state that list had been wrong for months: `tailwind.config.js` had
    // already moved both live tokens to `rgb(var(--…-rgb) / <alpha-value>)`,
    // which is precisely the form that DOES compose an alpha. Measured before
    // changing anything — `npx tailwindcss` on a stub emits
    // `.bg-primary\/10 { background-color: rgb(var(--color-primary-rgb, 26 35 50) / 0.1) }`.
    //
    // A guard that remembers a fact outlives the fact. This one derives it, so
    // reverting the alpha-value placeholder re-arms the ban by itself, and
    // `tertiary` — which is not a top-level colour at all, so an opacity on it
    // composes nothing — is caught for the right reason rather than by name.
    const cannotCarryAlpha = ALPHA_CANDIDATES.filter(token => !carriesAlpha(token));

    // The list must never be empty by accident: an empty alternation matches
    // everything, so a `(?:)` here would fail on every colour utility in the
    // app. Nothing to ban is a pass, and today `tertiary` keeps it non-empty.
    if (cannotCarryAlpha.length === 0) return;

    const hits = findInSource(
      new RegExp(`\\b(?:dark:)?(?:bg|text|border)-(?:${cannotCarryAlpha.join('|')})\\/\\d+`)
    );
    expect(
      hits,
      `These emit no CSS (opacity on a token with no <alpha-value>: ${cannotCarryAlpha.join(', ')}):\n${hits.join('\n')}`
    ).toEqual([]);
  });

  it('gives every !important colour utility a dark-mode counterpart', () => {
    // The `.text-theme-heading` failure. An `!important` colour beats the
    // `dark:` variant a call site writes, so the utility itself must answer
    // for both themes — the call sites are powerless to.
    // `color:` and `border-color:`, but NOT `background-color:`.
    //
    // The first pass took only `color:`, reasoning that a brand surface stays
    // navy on both grounds and only ink has to flip. Half right: a BACKGROUND
    // is a surface, and `.bg-primary` is correct in both modes. A BORDER
    // usually is not — `.border-primary` is the ring that says which tile is
    // selected, and navy on a gray-800 modal is no ring at all. That shipped,
    // and was read from screenshots as "no type is selected".
    //
    // (Also written as `\bcolor:` at one point, which matched
    // `background-color` and reported ten false positives.)
    const importantColourRules = [
      // `\s*` OUTSIDE the alternation. With it inside — `(?:^|[;{]\s*)color:` —
      // neither branch could reach an indented `color:`, so this matched
      // nothing and the assertion passed with the bug reintroduced. Caught by
      // deleting the fix and watching the test stay green.
      ...CSS.matchAll(/^\.([\w-]+)\s*\{[^}]*?(?:[;{]|^)\s*(?:border-)?color:[^;]*!important/gm),
    ].map((match) => match[1]);

    // `dark-exempt:` in a comment ON the rule is how a utility says its GROUND
    // does not change with the theme — the sidebar's navy, for instance. It has
    // to be written deliberately and it has to give a reason, which is the
    // point: the exemptions worth having are the ones somebody argued for.
    const exempt = new Set(
      [...CSS.matchAll(/dark-exempt:[^*]*\*\/\s*\n\.([\w-]+)\s*\{/g)].map((m) => m[1])
    );

    const missing = importantColourRules.filter(
      (name) => !exempt.has(name) && !new RegExp(`\\.dark\\s+\\.${name}\\b`).test(CSS)
    );

    expect(
      missing,
      `These force a colour or a border with !important and have no .dark rule, ` +
        `so they paint the same on both grounds:\n${missing.map((n) => `.${n}`).join('\n')}`
    ).toEqual([]);
  });

  it('still forces the heading colour in both modes, which is the fix itself', () => {
    // Guards the repair rather than the bug: if the .dark rule is ever dropped
    // the test above catches it, and if the base rule is dropped this does.
    expect(CSS).toMatch(/\.text-theme-heading\s*\{\s*color:\s*var\(--color-secondary\)\s*!important/);
    expect(CSS).toMatch(/\.dark\s+\.text-theme-heading\s*\{\s*color:\s*#f9fafb\s*!important/);
  });
});

/**
 * THE TOUCH-ONLY MEDIA QUERY MAY SET HIT AREAS, NOT LAYOUT.
 *
 * `@media (hover: none) and (pointer: coarse)` never matches a desktop
 * browser, so anything it gets wrong is invisible to everyone developing the
 * app and visible to everyone using it on a phone. It has now caused three
 * separate bugs:
 *
 *   1. `position: relative` on every button — which outranks Tailwind's
 *      `.fixed` — put the floating + at the screen's left edge and squeezed
 *      <main> off-centre on every touch device.
 *   2. `min-width: 44px` turned a 24px count pill into a 31×44 oval and lifted
 *      its label 12px.
 *   3. `padding: 8px 12px` on text inputs beat every `pl-*` utility in the app
 *      — `input[type="text"]` is (0,1,1), a class is (0,1,0) — so the
 *      watchlist's search icon sat on top of its own placeholder.
 *
 * The pattern is the same each time: a property that belongs to a COMPONENT
 * being set globally, from a block nobody can see. Hit area is this block's
 * business. Position, padding and size are not.
 */
describe('the touch-only block sets hit areas and nothing else', () => {
  it('declares no property that a component would reasonably own', () => {
    const start = CSS.indexOf('@media (hover: none) and (pointer: coarse)');
    expect(start).toBeGreaterThan(-1);

    // Walk to the matching close brace so the whole block is examined.
    let depth = 0;
    let end = start;
    for (let i = CSS.indexOf('{', start); i < CSS.length; i += 1) {
      if (CSS[i] === '{') depth += 1;
      else if (CSS[i] === '}') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }

    // Rules carrying a `hit-area:` comment are declaring that the property IS
    // the target region rather than layout — a 24px checkbox with 10px margins
    // is the only way to give it a 44px region. Written deliberately, with a
    // reason, exactly like the `dark-exempt:` marker one suite over.
    const raw = CSS.slice(start, end);
    const block = raw
      .split(/(?=\/\* hit-area:)/)
      .map((chunk, i) => (i > 0 && chunk.startsWith('/* hit-area:') ? '' : chunk))
      .join('')
      .replace(/\/\*[\s\S]*?\*\//g, ''); // its own commentary names the banned ones

    // `position` is banned outright; `padding`/`margin`/`width`/`height` are
    // banned as SHORTHANDS or absolutes. `min-width`/`min-height` are the hit
    // area and are the point of the block. `.touch-target-small::after` is the
    // invisible expanded hit area, which legitimately positions itself.
    const offenders = [...block.matchAll(/^\s*(position|padding|margin|width|height)\s*:/gm)]
      .map((m) => m[1])
      .filter((prop) => !(prop === 'position' && block.includes('.touch-target-small')))
      .filter((prop) => !(['width', 'height'].includes(prop) && block.includes('::after')));

    expect(
      offenders,
      `This block may set min-width/min-height. It set: ${offenders.join(', ')}. ` +
        `A property a component owns, set from a query that never matches a desktop, ` +
        `is a bug nobody developing the app can see.`
    ).toEqual([]);
  });
});
