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
 *   3. A call that names NO region — `(1234).toLocaleString()`,
 *      `a.localeCompare(b)`, or either with an explicit `undefined` in the
 *      locale slot. See below.
 *
 * ── THE THIRD RULE, ADDED 2 SEP 2026 ────────────────────────────────────────
 *
 * This guard used to say, in this spot, that it did NOT cover the bare call —
 * that there were ~180 of them, that they were a real gap, and that widening it
 * later would be "a matter of adding a third rule here, not of hunting the call
 * sites again". That turned out to be exactly true, and this is that rule.
 *
 * The bare call is the subtler of the two bugs. `(1234).toLocaleString()` names
 * no region, so it reads as neutral — and it is not: it asks the BROWSER. That
 * makes Settings ▸ Region & Date Format a control which governs some of the
 * app's output and not the rest, with the split depending on the machine rather
 * than on anything the reader can see. It is also invisible to review from a
 * UK desk, because a UK browser gives the same answer as the setting.
 *
 * The sweep that closed the gap moved 302 sites. It was safe to do at once
 * because en-GB and en-US group numbers and order text IDENTICALLY, so only the
 * ~20 date and time sites changed what they print — which was the reported bug.
 *
 * ── NO ALLOWLIST FOR RULE 3, ON PURPOSE ─────────────────────────────────────
 *
 * Rules 1 and 2 need exceptions: the selector must be able to OFFER 'en-US',
 * and the default has to be written down once. Rule 3 needs none, because
 * "whatever this machine is set to" is never the right answer for a reader who
 * has been given a setting — not even in `dateFormatter` or `localeFormat`,
 * which reach for `getDateLocale()` like everything else. If a genuine case
 * ever appears, it gets an entry here and an argument beside it.
 *
 * `getDateLocale()` is the answer to every one of these: the explicit choice,
 * and en-GB when there is none. `utils/localeFormat.ts` wraps it for counts and
 * for sorting, and explains why those are functions rather than an argument.
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
 * Rule 3, the formatting half: a `toLocale*String` whose locale slot is empty,
 * or holds an options bag, or holds `undefined`. All three mean the browser.
 *
 * Only the START of the argument list is inspected, which is all this needs to
 * be sure — and is why it cannot be fooled by whatever the options bag says.
 */
const BROWSER_LOCALE_FORMAT = /\.(toLocale(?:Date|Time)?String)\(\s*(?:\)|\{|undefined\b)/g;

/**
 * Rule 3, the sorting half. `localeCompare` hides its locale in the SECOND
 * argument, so it needs the arguments actually parsed rather than matched:
 * a regex that stops at the first `)` reads `a.localeCompare(name(b), locale)`
 * as a bare call, and a guard that cries wolf over a correct line is a guard
 * somebody deletes. Returns null when the call is not bare.
 */
function bareLocaleCompareAt(text: string, open: number): string[] | null {
  const args = callArguments(text, open);
  if (args === null) return null;
  if (args.length < 2) return args;
  return /^undefined$/.test(args[1]) ? args : null;
}

/** The balanced argument list of a call whose `(` is at `open`. */
function callArguments(text: string, open: number): string[] | null {
  let depth = 0;
  let quote: string | null = null;
  let close = -1;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote !== null) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close === -1) return null;

  const args: string[] = [];
  let current = '';
  depth = 0;
  quote = null;
  const inner = text.slice(open + 1, close);
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote !== null) {
      current += c;
      if (c === '\\') { current += inner[i + 1] ?? ''; i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; current += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += c;
  }
  if (current.trim() !== '') args.push(current.trim());
  return args;
}

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

interface BareFinding {
  file: string;
  line: number;
  call: string;
  remedy: string;
}

/**
 * Rule 3's findings for one file. Works on the whole comment-stripped source
 * rather than line by line, because a `localeCompare` argument list is allowed
 * to wrap and its locale would then sit on the next line.
 */
function bareCallsIn(file: string, source: string): BareFinding[] {
  const code = codeLines(source).join('\n');
  const lineOf = (index: number): number => code.slice(0, index).split('\n').length;
  const found: BareFinding[] = [];

  for (const match of code.matchAll(BROWSER_LOCALE_FORMAT)) {
    const method = match[1];
    found.push({
      file,
      line: lineOf(match.index),
      call: `${method}(…)`,
      remedy:
        method === 'toLocaleString'
          ? 'use formatCount() from utils/localeFormat (or getDateLocale() for a date-time)'
          : 'pass getDateLocale(), or use formatShortDate/formatDate',
    });
  }

  const COMPARE = '.localeCompare(';
  for (let at = code.indexOf(COMPARE); at !== -1; at = code.indexOf(COMPARE, at + 1)) {
    if (bareLocaleCompareAt(code, at + COMPARE.length - 1) === null) continue;
    found.push({
      file,
      line: lineOf(at),
      call: 'localeCompare(…)',
      remedy: 'use compareText()/compareNames() from utils/localeFormat',
    });
  }
  return found;
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

  it('asks no call to fall back on whatever region the machine is set to', () => {
    const bare = files.flatMap(file =>
      bareCallsIn(relative(process.cwd(), file), readFileSync(file, 'utf8'))
    );
    const offences = bare.map(f => `${f.file}:${f.line} — bare ${f.call}, ${f.remedy}`);

    expect(offences).toEqual([]);
  });

  it('leaves the hook the phone register formats its dates with no way to ignore the setting', () => {
    // The specific regression: a `locale` parameter defaulting to 'en-US',
    // which every caller took.
    const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useFormattedValues.ts'), 'utf8');
    expect(hook).toContain('getDateLocale()');
    expect(hook).not.toMatch(/locale\s*:\s*string\s*=/);
  });
});
