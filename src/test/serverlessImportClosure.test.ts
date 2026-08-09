import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Every api/ function runs in Vercel's node ESM runtime, where a relative
 * import WITHOUT a .js extension fails at module load with ERR_MODULE_NOT_FOUND
 * — the function dies as FUNCTION_INVOCATION_FAILED before the handler (or the
 * Sentry wrapper) ever executes. Nothing local catches it: Vite, vitest and
 * `tsc` all accept the extensionless form, so the first sign is a 500 in
 * production.
 *
 * It has now happened twice: the src/types barrel import (which forced the
 * accountType.ts leaf module), and bankBalanceSnapshot.ts importing
 * './cardNormalization' — which killed /api/banking/discover-accounts,
 * /api/banking/sync-accounts and every hourly auto-sync from the moment it
 * deployed (incident 2026-08-09, "0 accounts updated" + server-error popups).
 *
 * The api/ handlers themselves learned the .js habit long ago; the failure
 * mode is a src/ module written for the Vite world getting drafted into the
 * serverless graph. So this spec walks the FULL import closure — every
 * api/**\/*.ts file and, transitively, every src/ module it reaches — and
 * refuses:
 *
 *   1. any relative import that does not end in .js (type-only included:
 *      erased today, but a later change to a value import must not resurrect
 *      the crash), and
 *   2. any relative .js import whose corresponding .ts source does not exist
 *      (a typo'd path compiles fine and dies the same way at runtime).
 *
 * Bare package specifiers (decimal.js, @vercel/node, …) are node_modules
 * resolution and are not this spec's business.
 */

const ROOT = path.resolve(__dirname, '../..');
const API_DIR = path.join(ROOT, 'api');

const listApiFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listApiFiles(full);
    return entry.endsWith('.ts') ? [full] : [];
  });

// Matches static imports, re-exports and dynamic import() calls. Comments are
// deliberately NOT stripped: a naive stripper mis-fired on the text
// "api/banking/*" inside a line comment (the /* opened a phantom block that
// swallowed the imports below it) and turned this guard into a silent pass.
// The trade is the right way round — a quoted `from './x'` in prose fails the
// build loudly with a file:line, while a swallowed import fails silently in
// production.
const SPECIFIER_RE = /(?:from\s*|import\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

const relativeSpecifiers = (file: string): { specifier: string; line: number }[] => {
  const source = readFileSync(file, 'utf8');
  const found: { specifier: string; line: number }[] = [];
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const line = source.slice(0, match.index).split('\n').length;
    found.push({ specifier, line });
  }
  return found;
};

/** `./cardNormalization.js` imported from a .ts file compiles from `./cardNormalization.ts`. */
const sourceForSpecifier = (importer: string, specifier: string): string =>
  path.resolve(path.dirname(importer), specifier.replace(/\.js$/, '.ts'));

describe('serverless import closure (api/ + every src module it reaches)', () => {
  const queue = listApiFiles(API_DIR);
  const closure = new Set<string>(queue);
  const missingExtension: string[] = [];
  const missingSource: string[] = [];

  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined) break;
    for (const { specifier, line } of relativeSpecifiers(file)) {
      const at = `${path.relative(ROOT, file)}:${line}`;
      if (!specifier.endsWith('.js')) {
        missingExtension.push(`${at} → '${specifier}'`);
        continue;
      }
      const source = sourceForSpecifier(file, specifier);
      if (!existsSync(source)) {
        missingSource.push(`${at} → '${specifier}' (no ${path.relative(ROOT, source)})`);
        continue;
      }
      if (!closure.has(source)) {
        closure.add(source);
        queue.push(source);
      }
    }
  }

  it('reaches beyond api/ itself (the walk is not vacuous)', () => {
    const srcModules = [...closure].filter((f) => f.startsWith(path.join(ROOT, 'src')));
    expect(srcModules.length).toBeGreaterThan(0);
    // Depth-2 witness: accountType.ts is imported by NO api/ file — it is only
    // reachable through accountNumberInput.ts's own import. Its presence proves
    // the walk parses the imports OF src modules, not just imports of them.
    // (If accountNumberInput ever drops that import, pick a new transitively-
    // reached witness rather than deleting this assertion.)
    expect(closure.has(path.join(ROOT, 'src/types/accountType.ts'))).toBe(true);
  });

  it('has no extensionless relative imports (ERR_MODULE_NOT_FOUND in production)', () => {
    expect(missingExtension).toEqual([]);
  });

  it('has no .js imports without a matching .ts source', () => {
    expect(missingSource).toEqual([]);
  });
});
