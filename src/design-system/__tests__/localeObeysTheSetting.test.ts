/**
 * Every date the user reads is in the region the user chose.
 *
 * ── WHY THIS IS A TEST AND NOT A STYLE NOTE ─────────────────────────────────
 *
 * 1 Sep 2026, from a real phone: Settings ▸ App ▸ Region & Date Format set to
 * English (UK), and the register still read "Jun 2, 2026". Nothing had
 * overridden the setting — it had never been asked. `useFormattedDate` took a
 * `locale` parameter that DEFAULTED to `'en-US'`, the card called it bare, and
 * four other places wrote `'en-US'` out by hand: an aria-label, the realtime
 * clock, the next billing date and a dashboard chart axis.
 *
 * A sweep fixes those. This fixes them for good, because the failure mode is
 * not carelessness — `toLocaleDateString('en-US', …)` is what a decade of
 * examples on the internet look like, and it renders something perfectly
 * plausible on the machine of whoever typed it.
 *
 * ── WHAT IT LOOKS FOR ───────────────────────────────────────────────────────
 *
 * Two shapes, over every source file in `src` (tests excluded, comments
 * stripped, so the prose above and the ones like it in `utils/dateFormatter`
 * are not evidence of anything):
 *
 *   1. A string literal standing in a LOCALE ARGUMENT — the first argument of
 *      `toLocaleDateString`/`toLocaleTimeString`/`toLocaleString` or of an
 *      `Intl.*` constructor, or the second of `localeCompare`. `'default'`
 *      counts: it means the machine's locale, which is not the reader's
 *      choice either.
 *   2. A BCP-47 tag anywhere else in the code — `const LOCALE = 'en-US'` is
 *      the same bug one indirection away.
 *
 * ── WHAT IT DOES NOT CLAIM ──────────────────────────────────────────────────
 *
 * A bare `toLocaleDateString()` with no argument at all also ignores the
 * setting — it takes the browser's locale — and there are ~180 of those. They
 * are a real gap and a separate piece of work; this guard is about the ones
 * that NAME a region, because naming a region the reader did not pick is the
 * bug that was reported. Widening it later is a matter of adding a third rule
 * here, not of hunting the call sites again.
 *
 * `getDateLocale()` is the answer to every one of these: the explicit choice,
 * and en-GB when there is none.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

/** Everything the app is built from. The incident lived in `hooks`. */
const ROOT = 'src';

/**
 * A literal in the locale slot of a formatting call.
 *
 * Deliberately anchored to the OPENING parenthesis: the option bags these
 * calls carry are full of innocent strings (`{ sensitivity: 'base' }`,
 * `{ month: 'long' }`), and a guard that reports those is a guard somebody
 * deletes. `localeCompare` gets its own pattern because its locale is the
 * second argument; `[^,)]*` stops at the first comma, so the overwhelmingly
 * common `localeCompare(b, undefined, { … })` does not match.
 */
const LOCALE_ARGUMENT: RegExp[] = [
  /\.toLocale(?:Date|Time)?String\(\s*(['"])([^'"]*)\1/g,
  /(?:new\s+)?Intl\.[A-Za-z]+\(\s*(['"])([^'"]*)\1/g,
  /\.localeCompare\([^,)]*,\s*(['"])([^'"]*)\1/g,
];

/** `en-US`, `en-GB`, `fr-CA`, `zh-Hans-CN` — a region, written down. */
const LOCALE_TAG = /(['"])([a-z]{2,3}(?:-[A-Z][a-z]{3})?-[A-Z]{2,3})\1/g;

/**
 * The literals that are allowed to name a region, and why each one is.
 *
 * Whole files rather than line numbers: a line number is a fact about
 * yesterday's editor, and a guard that has to be re-numbered whenever
 * something is inserted above it gets switched off instead of updated.
 */
const ALLOWED: { file: string; reason: string }[] = [
  {
    file: 'src/components/settings/LocaleSelector.tsx',
    reason:
      'The eight regions ARE the setting — this file offers en-US as a choice ' +
      'rather than imposing it, and it is what makes getDateLocale answer.',
  },
  {
    file: 'src/utils/dateFormatter.ts',
    reason:
      "The app's default locale lives here, once: DEFAULT_LOCALE = 'en-GB', " +
      'which is the answer everything else reads through getDateLocale().',
  },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/**
 * The file as lines with comments blanked, so the line numbers reported are
 * the line numbers in the editor. Same shape as the UK-English guard beside
 * this one, and for the same reason: this codebase's comments quote the very
 * literals being hunted.
 */
function codeLines(source: string): string[] {
  let inBlock = false;
  return source.split('\n').map(raw => {
    let line = raw;
    if (inBlock) {
      const close = line.indexOf('*/');
      if (close === -1) return '';
      line = line.slice(close + 2);
      inBlock = false;
    }
    const open = line.indexOf('/*');
    if (open !== -1) {
      const close = line.indexOf('*/', open + 2);
      if (close === -1) {
        inBlock = true;
        line = line.slice(0, open);
      } else {
        line = line.slice(0, open) + line.slice(close + 2);
      }
    }
    const lineComment = line.indexOf('//');
    if (lineComment !== -1) line = line.slice(0, lineComment);
    return line;
  });
}

interface Finding {
  file: string;
  line: number;
  literal: string;
  rule: 'locale argument' | 'locale tag';
}

function findingsIn(file: string, source: string): Finding[] {
  const found: Finding[] = [];
  codeLines(source).forEach((line, index) => {
    for (const pattern of LOCALE_ARGUMENT) {
      for (const match of line.matchAll(pattern)) {
        found.push({ file, line: index + 1, literal: match[2], rule: 'locale argument' });
      }
    }
    for (const match of line.matchAll(LOCALE_TAG)) {
      const literal = match[2];
      // A tag inside a formatting call is already reported once; saying it
      // twice would make one mistake look like two.
      if (found.some(f => f.line === index + 1 && f.literal === literal)) continue;
      found.push({ file, line: index + 1, literal, rule: 'locale tag' });
    }
  });
  return found;
}

describe('the region the reader chose is the region the app prints', () => {
  const root = resolve(process.cwd(), ROOT);
  const files = sourceFiles(root);
  const findings = files.flatMap(file =>
    findingsIn(relative(process.cwd(), file), readFileSync(file, 'utf8'))
  );
  const allowedFiles = new Set(ALLOWED.map(entry => entry.file));

  it('has source to read at all (the guard is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('still recognises a hard-coded locale when it sees one', () => {
    // The allowlist doubles as the guard's own fixture: these literals are
    // real, they are supposed to be found, and if a pattern above ever stops
    // matching them it has stopped matching everything else too.
    const selector = findings.filter(
      f => f.file === 'src/components/settings/LocaleSelector.tsx'
    );
    expect(selector.map(f => f.literal)).toContain('en-US');
    expect(selector.length).toBeGreaterThanOrEqual(8);
    expect(
      findings.some(f => f.file === 'src/utils/dateFormatter.ts' && f.literal === 'en-GB')
    ).toBe(true);
  });

  it('names no region outside the two files that are allowed to', () => {
    const offences = findings
      .filter(f => !allowedFiles.has(f.file))
      .map(f => `${f.file}:${f.line} — ${f.rule} '${f.literal}' (use getDateLocale())`);

    expect(offences).toEqual([]);
  });

  it('keeps a reason beside every exception', () => {
    for (const entry of ALLOWED) {
      expect(entry.reason.length).toBeGreaterThan(40);
      // An allowlist entry for a file that no longer has a literal in it is a
      // licence nobody is using and the next person will inherit.
      expect(findings.some(f => f.file === entry.file)).toBe(true);
    }
  });

  it('leaves the hook the phone register formats its dates with no way to ignore the setting', () => {
    // The specific regression: a `locale` parameter defaulting to 'en-US',
    // which every caller took.
    const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useFormattedValues.ts'), 'utf8');
    expect(hook).toContain('getDateLocale()');
    expect(hook).not.toMatch(/locale\s*:\s*string\s*=/);
  });
});
