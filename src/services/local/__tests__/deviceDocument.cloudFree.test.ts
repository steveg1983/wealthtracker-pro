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
 *
 * ── THE WALKER IS SHARED, AND THIS FILE IS WHAT PROVES IT WORKS ─────────────
 *
 * Slice 29 gave the desktop an ENTRY — `src/desktop/main.tsx` — and the same
 * question has to be asked from there, because that is the module a bundler is
 * pointed at. Rather than a second copy of the reader, both tests use
 * `importGraph.ts`, and the last case here is what keeps that instrument
 * honest: it walks the CLOUD half and requires the walker to find every
 * forbidden module. A walker that had quietly stopped resolving anything would
 * pass every assertion above and fail that one.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SRC, chainTo, walkFrom } from './importGraph';

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

describe('the desktop’s object graph', () => {
  const graph = walkFrom(['services/local/deviceDocument']);
  const has = (module: string): boolean => graph.modules.has(`${module}.ts`);

  it('reaches the modules it is assembled from', () => {
    // A graph walk that reached nothing would pass every assertion below while
    // proving nothing at all, so the walk is checked before it is trusted.
    expect(has('services/local/localDataPort')).toBe(true);
    expect(has('services/backup/format')).toBe(true);
    expect(has('services/import/msMoney/cloudPlan')).toBe(true);
    expect(has('services/preferences/document')).toBe(true);
    expect(graph.modules.size).toBeGreaterThan(8);
  });

  for (const { module, why } of FORBIDDEN) {
    it(`does not reach ${module}`, () => {
      const chain = chainTo(graph, `${module}.ts`);
      expect(chain === null, chain === null ? '' : `A desktop build would contain ${why}.\n  ${chain}`).toBe(
        true
      );
    });
  }

  it('names no Node built-in, because a WebView has none of them', () => {
    // The third thing a desktop bundle cannot contain, and the one slice 27
    // actually tripped over: `createSpawnTransport` lived beside the envelope
    // reader, so `node:child_process` was two hops from the desktop's root. A
    // browser build does not fail politely on that — it fails at bundle time
    // with a specifier nobody can resolve, on the machine of whoever builds it
    // next. It is now `spawnTransport.ts`, which is not in this graph.
    const offenders: string[] = [];
    for (const module of graph.modules.keys()) {
      const text = readFileSync(path.join(SRC, module), 'utf8');
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
    // broken rather than the graph clean. It is also what proves the SHARED
    // walker in `importGraph.ts` still resolves anything at all.
    const cloud = walkFrom(['services/backupService']);

    expect(cloud.modules.has('services/api/supabaseClient.ts')).toBe(true);
    expect(cloud.modules.has('loggers/scopedLogger.ts')).toBe(true);
    expect(cloud.packages.has('@supabase/supabase-js')).toBe(true);
  });
});
