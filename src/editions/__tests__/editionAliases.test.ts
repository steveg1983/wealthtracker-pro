/**
 * THE FOUR SEAMS ARE SUBSTITUTIONS, and this is what keeps them ones.
 *
 * `services/__tests__/dataAlias.test.ts` makes this argument for `@data` and
 * makes it well; everything it says applies here four more times, so the prose
 * is not repeated and the checks are. What IS worth saying is why the checks
 * cannot be inherited from the compiler:
 *
 *   * the two halves are never imported together. `tsc -b` compiles the cloud
 *     half in `tsconfig.app.json` and the device half in `tsconfig.desktop.json`,
 *     and neither project can see the other's;
 *   * a bundler only ever resolves each specifier one way per build;
 *   * so a device half that forgot to export `RealtimeDot` would compile, pass
 *     every test, lint clean — and fail `npm run desktop:ui` on somebody else's
 *     machine, months later, in an error naming Layout.
 *
 * The declarations are checked for the blunter reason `dataAlias.test.ts` gives:
 * an alias one config knows about and another does not fails as *"Cannot find
 * module"* in whichever command is run next by whoever is least expecting it.
 * There are now five specifiers and six configs, which is thirty mappings that
 * have to agree.
 *
 * ── WHY IT READS THE FILES AS TEXT ──────────────────────────────────────────
 *
 * Importing the device halves would RUN them, and `desktop/editions/chrome.tsx`
 * is a React module while this suite is asserting a list of names. Text is also
 * what makes the last test possible: a seam added to `vite.config.ts` and not to
 * this file is caught here, and no amount of importing would catch that.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (relative: string): string => readFileSync(path.join(REPO, relative), 'utf8');

/** One seam: the specifier, and the file each build resolves it to. */
interface Seam {
  readonly specifier: string;
  readonly web: string;
  readonly device: string;
}

/**
 * The mount slice's four. `@data` is not here — it has its own test, with its
 * own argument about why an ENGINE is a different kind of thing to swap than a
 * component, a hook or a sink.
 */
const SEAMS: readonly Seam[] = [
  {
    specifier: '@chrome',
    web: 'src/editions/cloud/chrome.tsx',
    device: 'src/desktop/editions/chrome.tsx'
  },
  {
    specifier: '@identity',
    web: 'src/editions/cloud/identity.ts',
    device: 'src/desktop/editions/identity.ts'
  },
  {
    specifier: '@prefs-store',
    web: 'src/editions/cloud/preferencesStore.ts',
    device: 'src/desktop/editions/preferencesStore.ts'
  },
  {
    specifier: '@telemetry',
    web: 'src/editions/cloud/telemetry.ts',
    device: 'src/desktop/editions/telemetry.ts'
  }
];

/** Every config that can resolve a module, and which edition each speaks for. */
const DECLARATIONS: ReadonlyArray<{ config: string; edition: 'web' | 'device' }> = [
  { config: 'vite.config.ts', edition: 'web' },
  { config: 'vitest.config.ts', edition: 'web' },
  { config: 'tsconfig.app.json', edition: 'web' },
  { config: 'apps/desktop/vite.config.ts', edition: 'device' },
  { config: 'vitest.local.config.ts', edition: 'device' },
  { config: 'tsconfig.desktop.json', edition: 'device' }
];

/** The names a module exports as VALUES. */
const valueExportsOf = (relative: string): string[] =>
  [...read(relative).matchAll(/^export const (\w+)/gm)].map(match => match[1]).sort();

/**
 * The names a module re-exports as TYPES, from its `export type { … } from`
 * block.
 *
 * Deliberately only that block, exactly as `dataAlias.test.ts` reads `@data`'s:
 * every one of these files lists the seam's vocabulary in one place and in
 * alphabetical order, which is what makes a textual comparison meaningful
 * rather than clever.
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

describe('the edition seams', () => {
  for (const seam of SEAMS) {
    describe(seam.specifier, () => {
      it('offers the same values in both editions', () => {
        // Equality, not containment, for `dataAlias.test.ts`'s reason: a device
        // half with EXTRA names is a door that admits code the web build cannot
        // compile, which is the same drift in the other direction.
        expect(valueExportsOf(seam.device)).toEqual(valueExportsOf(seam.web));
      });

      it('offers the same types in both editions', () => {
        expect(typeExportsOf(seam.device)).toEqual(typeExportsOf(seam.web));
      });

      it('is declared in every config that resolves a module', () => {
        const wrong: string[] = [];
        for (const { config, edition } of DECLARATIONS) {
          const source = read(config);
          const mapping = new RegExp(`['"]${seam.specifier}['"]:[^\\n]*`).exec(source);
          if (mapping === null) {
            wrong.push(`${config} declares no '${seam.specifier}' mapping at all`);
            continue;
          }
          // Matched on which HALF is named rather than on a path, because the
          // six configs spell a path four ways. A device mapping names the
          // desktop tree; a web mapping names the cloud directory. Anything
          // else is a mapping that points at neither.
          const names = /desktop/.test(mapping[0])
            ? 'device'
            : /cloud/.test(mapping[0])
              ? 'web'
              : 'neither';
          if (names !== edition) {
            wrong.push(
              `${config} should map '${seam.specifier}' to the ${edition} half: ${mapping[0].trim()}`
            );
          }
        }
        expect(wrong).toEqual([]);
      });
    });
  }

  it('declares every seam before the bare "@" alias, which would otherwise claim them', () => {
    // Vite matches aliases in declaration order, by prefix. With '@' first,
    // '@chrome' resolves to `src/…chrome` — a path that does not exist, in an
    // error that says nothing about aliases.
    for (const config of ['vite.config.ts', 'vitest.config.ts']) {
      const source = read(config);
      for (const seam of SEAMS) {
        expect(source.indexOf(`'${seam.specifier}':`), `${config} — ${seam.specifier}`).toBeLessThan(
          source.indexOf("'@':")
        );
      }
    }
  });

  it('knows about every seam the web build declares, so a fifth cannot arrive untested', () => {
    // The one check that is about this FILE rather than about the seams. A
    // specifier added to `vite.config.ts` and to five other configs, wired
    // through a component, and never listed here would have no substitution
    // check at all — and the failure it would eventually cause is the one this
    // whole suite exists to prevent.
    const declared = [...read('vite.config.ts').matchAll(/^\s*'(@[\w-]+)':/gm)]
      .map(match => match[1])
      .sort();

    expect(declared).toEqual(['@chrome', '@data', '@identity', '@prefs-store', '@telemetry']);
  });

  it('would notice — the comparison is over real and non-trivial lists', () => {
    // The equalities above are vacuously true of two empty files. `@chrome` is
    // the big one: eight pieces of furniture, and `RealtimeDot` is certainly
    // one of them.
    const chrome = valueExportsOf('src/editions/cloud/chrome.tsx');
    expect(chrome.length).toBe(8);
    expect(chrome).toContain('RealtimeDot');
    expect(typeExportsOf('src/editions/cloud/chrome.tsx')).toContain('GlobalSearchHandle');
    expect(valueExportsOf('src/desktop/editions/telemetry.ts')).toEqual([
      'captureException',
      'captureMessage'
    ]);
  });
});
