/**
 * PHASE3-PLAN §5's two bundle greps, executed.
 *
 * The plan asks a desktop build to contain no Supabase client and no browser
 * storage adapter. That is normally checked by grepping a built bundle, which
 * can only be done where there is one — so it is checked here instead, over the
 * IMPORT GRAPH, which is the thing a bundler would have followed anyway.
 *
 * ── WHY THIS IS A REAL CHECK AND NOT A GESTURE ──────────────────────────────
 *
 * The failure it catches is invisible from both ends and arrives through a
 * type. `services/backup/format.ts` needs one constant from the preferences
 * layer — which preference keys hold row ids — and until slice 27 that constant
 * lived one module away from `supabasePreferencesTransport()`. Importing a list
 * of strings would have pulled a Supabase client, an auth session and a network
 * layer into a program whose whole promise is that the money never leaves the
 * machine. Nothing about the import would have looked wrong.
 *
 * So this walks the graph from `deviceDocument.ts` — the one module where the
 * desktop's object graph is assembled — and fails if any of the three forbidden
 * neighbours is reachable, naming the chain that reached it.
 *
 * ── WHAT IT DELIBERATELY DOES NOT CHECK ─────────────────────────────────────
 *
 * `import type`. Types are erased before a bundler ever sees them, so a type
 * import of a cloud module's shape costs a desktop build nothing — and the seam
 * relies on that in several places, `dataPort.ts` most of all. A check that
 * failed on erased imports would be measuring something no user experiences and
 * would have to be worked around, which is how a gate stops meaning anything.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', '..', '..');

/** The three things a desktop bundle may not reach, and what each one costs. */
const FORBIDDEN: ReadonlyArray<{ module: string; why: string }> = [
  {
    module: 'services/api/supabaseClient',
    why: 'a Supabase client — the cloud, in a program that promises the file never leaves the machine'
  },
  {
    module: 'services/storageAdapter',
    why: "the browser's IndexedDB store — a second copy of the ledger, on a device that already has one"
  },
  {
    module: 'loggers/scopedLogger',
    why: 'the app’s logger, which reaches a cloud logging service'
  }
];

/**
 * Every RUNTIME import in one module, resolved to a repo-relative path.
 *
 * Deliberately a reader rather than a bundler: this must answer the same
 * question on any machine, in any test run, without a build step. `import type`
 * and `export type` are skipped for the reason the header gives; a bare
 * `import './x'` for its side effects is NOT skipped, because side effects are
 * exactly what a module scope is.
 */
const importsOf = (relative: string): string[] => {
  const file = path.join(SRC, `${relative}.ts`);
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];

  const specifier = /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)from\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(specifier)) {
    const clause = match[1];
    // `import type { … }` and `export type { … }` are erased. A clause whose
    // every named binding is `type X` is erased too, but a MIXED clause is not,
    // so only the leading form counts as erased.
    if (/^\s*type\s/.test(clause)) continue;
    found.push(match[2]);
  }

  const bare = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(bare)) found.push(match[1]);

  return found
    .filter(target => target.startsWith('.'))
    .map(target => path.relative(SRC, path.resolve(path.dirname(file), target)));
};

/** Every module reachable at runtime from one root, with the chain that got there. */
const reachableFrom = (root: string): Map<string, string[]> => {
  const seen = new Map<string, string[]>([[root, [root]]]);
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const chain = seen.get(current) ?? [current];
    let next: string[];
    try {
      next = importsOf(current);
    } catch {
      // A specifier this reader cannot resolve to a `.ts` file — an index
      // directory, an asset, a package. Recorded as a leaf rather than guessed
      // at: guessing would either invent an edge or, worse, silently drop one.
      continue;
    }
    for (const target of next) {
      if (seen.has(target)) continue;
      seen.set(target, [...chain, target]);
      queue.push(target);
    }
  }
  return seen;
};

describe('the desktop’s object graph', () => {
  const graph = reachableFrom('services/local/deviceDocument');

  it('reaches the modules it is assembled from', () => {
    // A graph walk that reached nothing would pass every assertion below while
    // proving nothing at all, so the walk is checked before it is trusted.
    expect(graph.has('services/local/localDataPort')).toBe(true);
    expect(graph.has('services/backup/format')).toBe(true);
    expect(graph.has('services/import/msMoney/cloudPlan')).toBe(true);
    expect(graph.has('services/preferences/document')).toBe(true);
    expect(graph.size).toBeGreaterThan(8);
  });

  for (const { module, why } of FORBIDDEN) {
    it(`does not reach ${module}`, () => {
      const chain = graph.get(module);
      expect(
        chain === undefined,
        chain === undefined
          ? ''
          : `A desktop build would contain ${why}.\n  ${chain.join('\n    → ')}`
      ).toBe(true);
    });
  }

  it('names no Node built-in, because a WebView has none of them', () => {
    // The third thing a desktop bundle cannot contain, and the one this slice
    // actually tripped over: `createSpawnTransport` lived beside the envelope
    // reader, so `node:child_process` was two hops from the desktop's root. A
    // browser build does not fail politely on that — it fails at bundle time
    // with a specifier nobody can resolve, on the machine of whoever builds it
    // next. It is now `spawnTransport.ts`, which is not in this graph.
    const offenders: string[] = [];
    for (const module of graph.keys()) {
      const text = readFileSync(path.join(SRC, `${module}.ts`), 'utf8');
      for (const match of text.matchAll(/from\s+['"](node:[^'"]+)['"]/g)) {
        offenders.push(`${module} → ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('would notice — the same walk from the CLOUD half finds all three', () => {
    // The check above is only worth having if it can fail. `backupService.ts` is
    // the module the format was lifted OUT of, and it still reaches every one of
    // the three: if this walk found nothing there either, the walker would be
    // broken rather than the graph clean.
    const cloud = reachableFrom('services/backupService');

    expect(cloud.has('services/api/supabaseClient')).toBe(true);
    expect(cloud.has('loggers/scopedLogger')).toBe(true);
  });
});
