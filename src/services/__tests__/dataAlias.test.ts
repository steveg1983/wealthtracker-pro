/**
 * `@data` IS A SUBSTITUTION, and this is what keeps it one.
 *
 * Shared UI imports the seam through a specifier that names no edition. Each
 * build says what that specifier is:
 *
 *     web      @data → src/services/port/index.ts          (DataService)
 *     desktop  @data → src/services/local/deviceDataPort.ts (the open file)
 *
 * A substitution is only a substitution if BOTH targets answer for the same
 * vocabulary. If the device module forgot to re-export `WipeProgress`, the web
 * build would compile, every test would pass, `npm run lint` would be silent —
 * and `npm run desktop:ui` would fail on a machine, months later, with an error
 * naming a component that had nothing to do with it. Nothing else in this
 * repository can notice that: the two modules are never imported together, tsc
 * compiles each in a project that can only see one of them, and a bundler only
 * ever resolves the alias one way per build.
 *
 * So this reads both files as text and compares what they say.
 *
 * ── WHY TEXT AND NOT AN IMPORT ──────────────────────────────────────────────
 *
 * Because importing the device module RUNS it, and running it throws on purpose:
 * `deviceDataPort.ts` resolves the port out of the open document at module
 * scope, and in a test process there is no ledger open. That refusal is a
 * feature (it is the ordering rule of the desktop mount, stated where a future
 * entry will read it) and `deviceDataPort.test.ts` asserts it directly. Here it
 * would only be an obstacle, and working around it would mean opening a real
 * ledger to answer a question about a list of type names.
 *
 * The five places the alias is DECLARED are checked the same way, and for a
 * blunter reason: an alias that one config knows about and another does not is
 * the failure this whole mechanism is most likely to have, and the configs are
 * the only place the mapping exists at all.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (relative: string): string => readFileSync(path.join(REPO, relative), 'utf8');

const WEB_TARGET = 'src/services/port/index.ts';
const DEVICE_TARGET = 'src/services/local/deviceDataPort.ts';

/**
 * The names one module re-exports as TYPES, from its `export type { … } from`
 * block.
 *
 * Deliberately only that block. Both files list the seam's vocabulary in one
 * place and in alphabetical order, which is what makes a textual comparison
 * meaningful rather than clever.
 */
const typeExportsOf = (relative: string): string[] => {
  const source = read(relative);
  const block = /export type \{([\s\S]*?)\} from/.exec(source);
  if (block === null) throw new Error(`${relative} has no \`export type { … } from\` block`);
  return block[1]
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .sort();
};

describe('the @data alias', () => {
  it('offers the same vocabulary in both editions', () => {
    // Equality, not containment. A device module with EXTRA names would be a
    // door that admits code the web build cannot compile, which is the same
    // drift in the other direction and just as expensive to find.
    expect(typeExportsOf(DEVICE_TARGET)).toEqual(typeExportsOf(WEB_TARGET));
  });

  it('offers the same value in both editions, and only that one', () => {
    // `dataPort`, in both, and nothing else: the seam is one object, and a
    // second export from either side would be an edition-specific door that
    // shared UI could reach through `@data` and only one build could answer.
    const valueExports = (relative: string): string[] =>
      [...read(relative).matchAll(/^export const (\w+)/gm)].map(match => match[1]).sort();

    expect(valueExports(WEB_TARGET)).toEqual(['dataPort']);
    expect(valueExports(DEVICE_TARGET)).toEqual(['dataPort']);
  });

  it('would notice — the comparison is over a real and non-trivial list', () => {
    // The two assertions above are vacuously true of two empty files. The seam's
    // vocabulary is thirty-odd names and `DataPort` is certainly one of them.
    const names = typeExportsOf(WEB_TARGET);
    expect(names.length).toBeGreaterThan(30);
    expect(names).toContain('DataPort');
  });

  it('is declared in every config that resolves a module', () => {
    // One row per build or run that can resolve an import. A missing row does
    // not fail loudly — it fails as "Cannot find module '@data'" in whichever
    // command is run next by whoever is least expecting it.
    const declarations: ReadonlyArray<{ config: string; edition: 'web' | 'device' }> = [
      { config: 'vite.config.ts', edition: 'web' },
      { config: 'vitest.config.ts', edition: 'web' },
      { config: 'tsconfig.app.json', edition: 'web' },
      { config: 'apps/desktop/vite.config.ts', edition: 'device' },
      { config: 'vitest.local.config.ts', edition: 'device' },
      { config: 'tsconfig.desktop.json', edition: 'device' }
    ];

    // Matched on the module's NAME rather than on a path, because the six
    // configs spell a path five ways — `'./src/services/port'`, an array in
    // JSON, `path.join(REPO, 'src', …)` — and a check that insisted on one
    // spelling would fail the first time somebody wrote a correct mapping
    // differently. What matters is which of the two engines is named.
    const wrong: string[] = [];
    for (const { config, edition } of declarations) {
      const source = read(config);
      const mapping = /['"]@data['"]:[^\n]*/.exec(source);
      if (mapping === null) {
        wrong.push(`${config} declares no '@data' mapping at all`);
        continue;
      }
      const names = mapping[0].includes('deviceDataPort') ? 'device' : 'web';
      if (names !== edition) {
        wrong.push(`${config} should map '@data' to the ${edition} engine: ${mapping[0].trim()}`);
        continue;
      }
      // …and the web mapping still has to name the port, or "not the device
      // engine" would be satisfied by a mapping that pointed anywhere at all.
      if (edition === 'web' && !/\bport\b/.test(mapping[0])) {
        wrong.push(`${config} maps '@data' to neither engine: ${mapping[0].trim()}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('is declared before the bare "@" alias, which would otherwise claim it', () => {
    // Vite matches aliases in declaration order, by prefix. With '@' first,
    // '@data' resolves to `src/…data` — a path that does not exist, in an error
    // that says nothing about aliases. It has to be first, so it is asserted to
    // be first.
    for (const config of ['vite.config.ts', 'vitest.config.ts']) {
      const source = read(config);
      expect(source.indexOf("'@data':"), config).toBeLessThan(source.indexOf("'@':"));
    }
  });
});
