import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A BUTTON IS A FLEX ROW WHETHER YOU ASKED FOR ONE OR NOT.
 *
 * `src/index.css` styles the bare element — `button { display: inline-flex;
 * align-items: center }` — so every button in the app is a flex container.
 * Its children are flex ITEMS, and a flex item's own `display: block` does
 * not put it on a line of its own: the parent's direction does. Two `block`
 * spans inside a button therefore render SIDE BY SIDE.
 *
 * That is not a hypothetical. The net-worth statement drew every account as a
 * name above its section label, and the two ran together on one line —
 * "Credit CardCredit cards · in credit" — for as long as the table had
 * existed. It went unnoticed because the label was short enough to read as
 * part of the name, and it was only Design's §1.1 labelling (25 Aug), which
 * made the label longer, that made it obvious. The CSV format picker had the
 * same fault in the same shape.
 *
 * This is the FOURTH member of a family: three rules in index.css that beat
 * Tailwind utilities and present as component bugs. What they have in common
 * is that the component looks correct in isolation — `block` really does mean
 * block — and only the cascade says otherwise. A source census is the cheap
 * defence, because jsdom does no layout and could not measure this even if a
 * rendered test wanted to.
 *
 * THE RULE: a button whose DIRECT children include two or more `block`-classed
 * elements must state its own direction (`flex-col`, `grid`, or `block`).
 * Nesting them inside one wrapper span is equally fine and is what most of the
 * app already does — that wrapper is the single flex item, and the blocks
 * stack inside it normally.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'test') continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) {
      out.push(full);
    }
  }
}

/**
 * The opening tag with its COMMENTS REMOVED.
 *
 * Not fussiness: the first draft of this census passed on a button whose only
 * mention of `flex-col` was the `//` comment explaining why the fix was
 * needed. A census that its own explanation satisfies is worse than none —
 * the same hole the touch-target census had to close, for the same reason.
 */
function withoutComments(tag: string): string {
  return tag.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** The opening tag starting at `i`, respecting `{…}` so `=>` cannot end it. */
function openTag(source: string, i: number): string {
  let depth = 0;
  for (let j = i; j < source.length; j += 1) {
    const c = source[j];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0 && source[j - 1] !== '=') return source.slice(i, j + 1);
  }
  return source.slice(i, i + 400);
}

/** `block`-classed elements that are DIRECT children of this button body. */
function directBlockChildren(body: string): number {
  const element = /<\/?(span|div|p|a)\b/g;
  let depth = 0;
  let count = 0;
  let index = 0;
  for (;;) {
    element.lastIndex = index;
    const match = element.exec(body);
    if (!match) return count;
    if (body[match.index + 1] === '/') {
      depth -= 1;
      index = element.lastIndex;
      continue;
    }
    const tag = openTag(body, match.index);
    if (depth === 0 && /className=(?:"|\{`)[^"`]*\bblock\b/.test(withoutComments(tag))) count += 1;
    if (!tag.trimEnd().endsWith('/>')) depth += 1;
    index = match.index + tag.length;
  }
}

describe('a button states its own direction before stacking rows inside it', () => {
  const files: string[] = [];
  walk(SRC, files);

  it('the census still has buttons to look at (never vacuously green)', () => {
    const total = files.reduce(
      (n, file) => n + (readFileSync(file, 'utf8').match(/<button\b/g)?.length ?? 0),
      0
    );
    expect(total).toBeGreaterThan(100);
  });

  it('the global rule that makes this necessary is still in the stylesheet', () => {
    // If someone removes it, this census becomes noise and should be deleted
    // rather than left standing as a rule nothing enforces.
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    expect(css).toMatch(/button[^{]*\{[^}]*display:\s*inline-flex/);
  });

  it('no button lays two block children out as a row by accident', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(process.cwd(), file).split('\\').join('/');
      const opener = /<button\b/g;
      for (;;) {
        const match = opener.exec(source);
        if (!match) break;
        const tag = openTag(source, match.index);
        const close = source.indexOf('</button>', match.index);
        if (close === -1) continue;
        const body = source.slice(match.index + tag.length, close);
        if (directBlockChildren(body) < 2) continue;
        if (/flex-col|grid|\bblock\b/.test(withoutComments(tag))) continue;
        offenders.push(`${rel}:${source.slice(0, match.index).split('\n').length}`);
      }
    }
    expect(
      offenders,
      `These buttons stack rows inside themselves but inherit the stylesheet's ` +
      `\`display: inline-flex\`, so their block children render SIDE BY SIDE. ` +
      `Add \`flex flex-col items-start\` to the button, or wrap the children in ` +
      `one span. Offenders: ${offenders.join(', ')}`
    ).toEqual([]);
  });
});
