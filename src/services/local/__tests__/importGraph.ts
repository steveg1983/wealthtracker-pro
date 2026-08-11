/**
 * A runtime import walk over the source tree. The instrument, not a test.
 *
 * Two tests ask the same question of two roots — "what can a desktop build
 * reach?" — one from `services/local/deviceDocument.ts` (the object graph) and
 * one from `src/desktop/main.tsx` (the entry a bundler is actually pointed at).
 * A second copy of the walker would be a second thing to get subtly wrong, and
 * the failure mode of a broken walker is silence: it finds nothing forbidden
 * because it finds nothing at all. Both tests therefore use this one, and both
 * assert that it can still fail (`deviceDocument.cloudFree.test.ts` walks the
 * CLOUD half and requires it to find every forbidden module there).
 *
 * ── WHAT IT DELIBERATELY DOES NOT COUNT ─────────────────────────────────────
 *
 * `import type` and `export type`. Types are erased before a bundler ever sees
 * them, so a type import of a cloud module's shape costs a desktop build
 * nothing — and the seam relies on that in several places, `dataPort.ts` most of
 * all. A check that failed on erased imports would be measuring something no
 * user experiences, and would have to be worked around, which is how a gate
 * stops meaning anything.
 *
 * ── WHAT IT COUNTS THAT A READER MIGHT NOT EXPECT ───────────────────────────
 *
 * A bare `import './x'` for its side effects, because side effects are exactly
 * what a module scope is — the whole class of failure this instrument exists for
 * is a module whose SCOPE builds a Supabase client. And `import('…')`, because
 * a lazily-loaded route is still in the bundle; it is merely in a different
 * chunk of it, and `apps/desktop/dist` is greppable as a whole.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

/** `src`, resolved from this file, which is two directories inside it. */
export const SRC = path.resolve(__dirname, '..', '..', '..');

/** One module in the graph: how it is named, and how it was reached. */
export interface Reached {
  /** The chain of module ids from the root, inclusive of both ends. */
  readonly chain: readonly string[];
}

export interface ImportGraph {
  /** Every module reachable at runtime, keyed by its repo-relative id. */
  readonly modules: ReadonlyMap<string, Reached>;
  /**
   * Every PACKAGE reachable at runtime, keyed by its specifier.
   *
   * Kept apart from the modules because the question they answer is different:
   * a module is something this repository wrote and can fix, a package is
   * something the bundle would carry whole. `@clerk/clerk-react` is the one
   * this exists for.
   */
  readonly packages: ReadonlyMap<string, Reached>;
}

/**
 * The specifiers one file imports at RUNTIME.
 *
 * Deliberately a reader rather than a bundler: this must answer the same
 * question on any machine, in any test run, without a build step.
 */
const specifiersOf = (file: string): string[] => {
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];

  const clause = /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)from\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(clause)) {
    // `import type { … }` and `export type { … }` are erased. A clause whose
    // every named binding is `type X` is erased too, but a MIXED clause is not,
    // so only the leading form counts as erased.
    if (/^\s*type\s/.test(match[1])) continue;
    found.push(match[2]);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) found.push(match[1]);
  for (const match of text.matchAll(/\bimport\(\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]([^'"]+)['"]\s*\)/g)) {
    found.push(match[1]);
  }
  return found;
};

/** A specifier's file on disk, trying what a bundler would try, or `null`. */
const resolveModule = (base: string): string | null => {
  for (const extension of ['.ts', '.tsx']) {
    if (existsSync(base + extension)) return base + extension;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of ['.ts', '.tsx']) {
      const index = path.join(base, `index${extension}`);
      if (existsSync(index)) return index;
    }
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  return null;
};

/**
 * Every module and package reachable at runtime from one or more roots.
 *
 * @param roots repo-relative-to-`src` module ids, without an extension —
 *   `'services/local/deviceDocument'`, `'desktop/main'`.
 * @param alias what a non-relative specifier means, when it means a file in
 *   this repository rather than a package. `@data` is the only one, and which
 *   file it is is the difference between the two editions — so the caller has
 *   to say, which is the point.
 */
export const walkFrom = (
  roots: readonly string[],
  alias: Readonly<Record<string, string>> = {}
): ImportGraph => {
  const modules = new Map<string, Reached>();
  const packages = new Map<string, Reached>();
  const queue: string[] = [];

  for (const root of roots) {
    const file = resolveModule(path.join(SRC, root));
    if (file === null) throw new Error(`No such module to walk from: ${root}`);
    const id = path.relative(SRC, file);
    modules.set(id, { chain: [id] });
    queue.push(id);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const chain = modules.get(current)?.chain ?? [current];

    for (const specifier of specifiersOf(path.join(SRC, current))) {
      const aliased = Object.hasOwn(alias, specifier) ? alias[specifier] : null;

      if (aliased === null && !specifier.startsWith('.')) {
        // A package, or a specifier this instrument was not told about. Both
        // are recorded under their own name rather than guessed at.
        if (!packages.has(specifier)) packages.set(specifier, { chain: [...chain, specifier] });
        continue;
      }

      const target =
        aliased === null
          ? path.resolve(path.dirname(path.join(SRC, current)), specifier)
          : path.join(SRC, aliased);
      const file = resolveModule(target);
      if (file === null) {
        // Not a `.ts`/`.tsx` file: a stylesheet, an asset, a JSON. Recorded as a
        // leaf rather than guessed at — guessing would either invent an edge or,
        // worse, silently drop one.
        continue;
      }
      const id = path.relative(SRC, file);
      if (modules.has(id)) continue;
      modules.set(id, { chain: [...chain, id] });
      queue.push(id);
    }
  }

  return { modules, packages };
};

/** The chain that reached one module or package, ready to print, or `null`. */
export const chainTo = (graph: ImportGraph, name: string): string | null => {
  const reached = graph.modules.get(name) ?? graph.packages.get(name);
  return reached === undefined ? null : reached.chain.join('\n    → ');
};
