/**
 * A HEADLINE FIGURE MUST DECLARE ITS OWN INK.
 *
 * The owner found the same defect on three pages in one sitting — "black
 * font" on What I'm committed to, Account balances and Account distribution
 * (24 Aug). One cause each time: a display-size figure carrying
 * `text-page font-bold` and NO colour class at all, so it inherited
 * whatever the cascade offered. On light ground that lands near-black and
 * looks deliberate; on dark ground it is near-black on near-black.
 *
 * Inheritance is not a colour DECISION — it is the absence of one, and a
 * page's largest number is the last place to leave it to chance. This
 * guard reads the source (the cheapest place to catch it: no theme, no
 * render, no ground to simulate) and fails on any `text-page` or
 * `text-display` element that names no ink.
 *
 * A file may opt out by naming a token that carries its own colour
 * (`text-primary`, `text-income`, an amount component) — those state a
 * decision, which is all this asks for.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

function tsxFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') return [];
      return tsxFilesUnder(path);
    }
    return entry.endsWith('.tsx') ? [path] : [];
  });
}

/** Any class that states an ink colour, token or utility. */
const NAMES_INK = /\btext-(gray|white|black|slate|zinc|neutral|red|green|blue|amber|yellow|orange|emerald|primary|secondary|tertiary|theme-heading|income|expense|on-primary-action|inherit|current)\b|\btext-\[/;

/** The display sizes a figure or page title uses. */
const HEADLINE_SIZE = /\btext-(page|display)\b/;

describe('every headline figure declares its own ink', () => {
  const offenders: string[] = [];

  for (const path of tsxFilesUnder(SRC)) {
    const content = readFileSync(path, 'utf8');
    // Every className="..." literal in the file. A template literal with a
    // conditional colour is left alone: it states a decision by construction.
    for (const match of content.matchAll(/className="([^"]*)"/g)) {
      const classes = match[1];
      if (!HEADLINE_SIZE.test(classes)) continue;
      if (NAMES_INK.test(classes)) continue;
      const line = content.slice(0, match.index).split('\n').length;
      offenders.push(`${relative(process.cwd(), path)}:${line} — ${classes}`);
    }
  }

  it('the sweep sees the headline elements it exists for', () => {
    // A refactor that renamed the size tokens would leave the clause below
    // vacuously green.
    const headlines = tsxFilesUnder(SRC)
      .flatMap(path => [...readFileSync(path, 'utf8').matchAll(/className="([^"]*)"/g)])
      .filter(m => HEADLINE_SIZE.test(m[1]));
    expect(headlines.length).toBeGreaterThanOrEqual(10);
  });

  it('names no colourless display-size figure', () => {
    expect(
      offenders,
      'these render at display size with no ink of their own — near-black on a dark ground'
    ).toEqual([]);
  });
});
