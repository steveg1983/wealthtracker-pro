/**
 * THE EDITION SEAMS ARE SUBSTITUTIONS, and this is what keeps them ones.
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
 * There are now eight specifiers and six configs, which is forty-eight
 * mappings that have to agree.
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
 * The mount slice's six, plus the rules store. `@data` is not here — it has its
 * own test, with its own argument about why an ENGINE is a different kind of
 * thing to swap than a component, a hook or a sink.
 */
const SEAMS: readonly Seam[] = [
  {
    specifier: '@chrome',
    web: 'src/editions/cloud/chrome.tsx',
    device: 'src/desktop/editions/chrome.tsx'
  },
  {
    specifier: '@session',
    web: 'src/editions/cloud/session.ts',
    device: 'src/desktop/editions/session.ts'
  },
  {
    specifier: '@service',
    web: 'src/editions/cloud/service.ts',
    device: 'src/desktop/editions/service.ts'
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
  },
  {
    // Added 28 Aug, when the owner asked whether import rules could be "cloud
    // based for the main app but local for the local download version". They
    // can, and this is the seam that makes it so.
    specifier: '@rules-store',
    web: 'src/editions/cloud/rulesStore.ts',
    device: 'src/desktop/editions/rulesStore.ts'
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

  it('knows about every seam the web build declares, so a ninth cannot arrive untested', () => {
    // The one check that is about this FILE rather than about the seams. A
    // specifier added to `vite.config.ts` and to five other configs, wired
    // through a component, and never listed here would have no substitution
    // check at all — and the failure it would eventually cause is the one this
    // whole suite exists to prevent.
    const declared = [...read('vite.config.ts').matchAll(/^\s*'(@[\w-]+)':/gm)]
      .map(match => match[1])
      .sort();

    expect(declared).toEqual([
      '@chrome',
      '@data',
      '@identity',
      '@prefs-store',
      '@rules-store',
      '@service',
      '@session',
      '@telemetry'
    ]);
  });

  it('would notice — the comparison is over real and non-trivial lists', () => {
    // The equalities above are vacuously true of two empty files. `@chrome` is
    // the big one: ten pieces of furniture — eight from the mount's first half
    // and two the BUNDLE GREP added in its second, when a PWA offline queue in
    // the frame turned out to be keeping writes for a server that does not
    // exist. `RealtimeDot` is certainly one of them. Plus two FACTS —
    // CHROME_HAS_BANK_FEEDS (26 Aug) and CHROME_HAS_PRICE_HISTORY (27 Aug) —
    // not furniture but booleans the callers ask before drawing their own
    // controls, after the first desktop install offered a nav item that
    // could only apologise.
    const chrome = valueExportsOf('src/editions/cloud/chrome.tsx');
    expect(chrome.length).toBe(12);
    expect(chrome).toContain('RealtimeDot');
    expect(chrome).toContain('CHROME_HAS_BANK_FEEDS');
    expect(chrome).toContain('CHROME_HAS_PRICE_HISTORY');
    expect(typeExportsOf('src/editions/cloud/chrome.tsx')).toContain('GlobalSearchHandle');
    expect(valueExportsOf('src/desktop/editions/telemetry.ts')).toEqual([
      'captureException',
      'captureMessage'
    ]);
    // `@session` is the mount's second half and its two halves are the least
    // alike of any pair here — a hundred lines of Clerk against three. One
    // exported hook, and it had better be the same one on both sides.
    expect(valueExportsOf('src/editions/cloud/session.ts')).toEqual(['useEditionSession']);
    expect(typeExportsOf('src/editions/cloud/session.ts')).toEqual([
      'EditionSession',
      'SessionPreamble',
      'UseEditionSession'
    ]);
    // `@service` is the other big one, and its list is the mount's own
    // measurement written down: seven surfaces, every one of them from one of
    // the three regions `NEVER_ON_A_DESKTOP` already rules out, all seven found
    // by walking the pages once the state layer stopped hiding them.
    //
    // `SignOutPanel` is the eighth and the only one the walk did not find,
    // because it did not exist to be found: `/settings` had no way to sign out
    // at all, and the only one in the app was an unlabelled avatar in the
    // header. Adding it put a piece of the `auth` region on a page this edition
    // mounts — the same shape as `DangerZone`, one page over — so it arrived
    // through the seam rather than as a Clerk import on a shared page. The
    // equality is what would have caught the second half being forgotten.
    //
    // `SessionGuard` is the NINTH, added 15 August, and it arrived for the same
    // reason `SignOutPanel` did: the Security Settings page had a Session
    // Timeout dropdown that stored a number nothing read, so a person could
    // choose "5 minutes" and stay signed in for a week. Making it true needs
    // `signOut`, which is `auth`, which a shared page may not import — so it
    // came through the seam rather than as a Clerk import beside the router.
    // This equality is what stops the desktop half being forgotten.
    expect(valueExportsOf('src/desktop/editions/service.ts')).toEqual([
      'BankConnections',
      'BankFeedRefreshSettings',
      'BankingCriticalIncidentBadge',
      'DangerZone',
      'SessionGuard',
      'SignOutPanel',
      'SubscriptionStatus',
      'useAccountBankSync',
      'useBankConnectionSnapshot'
    ]);
  });
});
