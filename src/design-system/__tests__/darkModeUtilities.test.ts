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

  it('never puts an opacity on a bare CSS variable', () => {
    // `bg-primary/20`, `text-primary/70`. Tailwind cannot compose an alpha
    // with `var(--x)`, so the whole declaration is dropped. The app's own
    // `nav-bg` tokens are the supported way to ask for this.
    const hits = findInSource(/\b(?:dark:)?(?:bg|text|border)-(?:primary|secondary|tertiary)\/\d+/);
    expect(hits, `These emit no CSS (opacity on a bare var()):\n${hits.join('\n')}`).toEqual([]);
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
