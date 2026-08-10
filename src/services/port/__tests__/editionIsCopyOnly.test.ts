/**
 * `capabilities.edition` IS COPY. Enforced with a grep, on purpose.
 *
 * The descriptor exists because one boolean — "are we on Supabase?" — was being
 * asked four unrelated questions: how many writes may be in flight, whether to
 * open a realtime subscription, where a backup goes, and whether a sentence
 * says "login" or "device". Splitting it into four named capabilities only
 * helps if the fifth field does not quietly become the fifth version of the old
 * boolean. `edition` is that fifth field: it is the app's WORD for which
 * edition somebody is using, and the moment production code writes
 * `if (edition === 'cloud')` the flag is back, an engine that is neither of
 * today's two is unrepresentable again, and the seam has bought nothing.
 *
 * WHY A GREP AND NOT A TYPE. There is no type that says "this value may be
 * rendered but not branched on" — a string union is a string union, and TypeScript
 * cannot tell an `if` from a ternary between two literals. The rule is about
 * WHERE a value may appear in the source, so the check reads the source. Crude,
 * and exactly the right size: it takes ten lines, it cannot be argued with, and
 * it fails on the diff that introduces the branch rather than in an audit two
 * years later.
 *
 * The rule, stated precisely: in production code (no tests, no type
 * declarations), every reference to `capabilities.edition` must be preceded by
 * `{`. In TSX that is a JSX expression container — `{capabilities.edition === …}`
 * as a child, or `attr={capabilities.edition === …}` as an attribute. Every other
 * position fails: `if (capabilities.edition` is preceded by a space,
 * `const e = capabilities.edition` by a space, `fn(capabilities.edition)` by a
 * parenthesis. Destructuring is barred separately, since `const { edition } = …`
 * would smuggle the value out to any position at all.
 *
 * What the rule deliberately does NOT police: the other four fields. Those are
 * capabilities rather than words, and branching on them is the entire point.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../..');

/** Where the seam DECLARES and BUILDS the field, as opposed to reading it. */
const DEFINITION_FILES = new Set([
  path.join(SRC, 'services', 'port', 'dataPort.ts'),
  path.join(SRC, 'services', 'api', 'dataService.ts')
]);

const isTestPath = (file: string): boolean =>
  /(^|[\\/])__tests__[\\/]/.test(file) ||
  /\.(test|spec)\.tsx?$/.test(file) ||
  /(^|[\\/])src[\\/]test[\\/]/.test(file);

function productionFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      productionFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !isTestPath(full) && !DEFINITION_FILES.has(full)) {
      out.push(full);
    }
  }
  return out;
}

interface Reference {
  file: string;
  line: number;
  text: string;
  /** The character immediately before the reference, or '' at line start. */
  precededBy: string;
}

const references = (): Reference[] => {
  const found: Reference[] = [];
  for (const file of productionFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('capabilities.edition')) continue;
    source.split('\n').forEach((text, index) => {
      let at = text.indexOf('capabilities.edition');
      while (at !== -1) {
        found.push({
          file: path.relative(SRC, file),
          line: index + 1,
          text: text.trim(),
          precededBy: at === 0 ? '' : text[at - 1]
        });
        at = text.indexOf('capabilities.edition', at + 1);
      }
    });
  }
  return found;
};

describe('capabilities().edition is copy, and only copy', () => {
  it('appears in production only inside a JSX expression', () => {
    const outsideJsx = references().filter(reference => reference.precededBy !== '{');

    // Named rather than counted: a failure here has to tell whoever wrote the
    // line WHICH line, because the fix is never "delete the assertion" — it is
    // "the thing you wanted is one of the other four capabilities".
    expect(
      outsideJsx.map(reference => `${reference.file}:${reference.line} — ${reference.text}`)
    ).toEqual([]);
  });

  it('is still rendered somewhere, so this file cannot pass by describing nothing', () => {
    // The companion assertion, and not a formality: the rule above is
    // vacuously true of a codebase that stopped saying "login" or "device"
    // altogether. It is satisfied today by the Export page's full-backup card
    // and the two backup cards in Data Management — the three sentences that
    // tell somebody whether the file they are about to download is a second
    // copy or the only one.
    expect(references().length).toBeGreaterThanOrEqual(3);
  });

  it('is never destructured out of the descriptor', () => {
    // `const { edition } = capabilities` would hand the value to a plain
    // identifier, and every position rule above is about the text
    // `capabilities.edition`. This is the one hole worth closing by hand.
    const smuggled: string[] = [];
    for (const file of productionFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('edition')) continue;
      source.split('\n').forEach((text, index) => {
        if (/\{[^}]*\bedition\b[^}]*\}\s*=/.test(text)) {
          smuggled.push(`${path.relative(SRC, file)}:${index + 1} — ${text.trim()}`);
        }
      });
    }
    expect(smuggled).toEqual([]);
  });
});
