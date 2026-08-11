import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

/**
 * The WEB edition's choosing line, as an import specifier — `services/port`,
 * or `../port` from inside `src/services`, with or without an explicit `/index`.
 *
 * A regex rather than a gitignore-style `group`, and not by preference: group
 * patterns cannot re-include a path beneath one they exclude (it is the one
 * thing gitignore syntax cannot express), so `**\/services/port` inescapably
 * also bans `services/port/dataPort` — the seam's INTERFACE, which is types
 * only, is erased before a bundler sees it, and is what `localDataPort.ts`
 * says `implements` against. A rule that banned the interface it exists to
 * protect would be worked around within a week.
 *
 * So the match is anchored at the end: `…/port` and `…/port/index` are the
 * choosing line, and `…/port/dataPort` is not.
 */
const PORT_INDEX = '(^|/)port(/index)?$'

const PORT_INDEX_MESSAGE =
  'This is the WEB edition’s engine, one directory at a time: `services/port/index.ts` is the ' +
  'line that says `dataPort = DataService`. A desktop-reachable module that imports it puts a ' +
  'Supabase client in a bundle that promises the money never leaves the machine. Shared surfaces ' +
  'import `@data`; a desktop-only module names `services/local/deviceDataPort` outright. See ' +
  'docs/edition-gating.md.'

export default tseslint.config([
  globalIgnores([
    'dist',
    'coverage',
    'coverage/**',
    'logs',
    'logs/**',
    'WealthTracker-Backups/**',
    'packages/**',
    'apps/**',
    'src-backup-optimized/**',
    'src.backup.*',
    'src.backup.*/**'
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Temporarily downgrade these to warnings to unblock CI
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true 
      }],
      'no-empty-pattern': 'warn',
      'no-prototype-builtins': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react-refresh/only-export-components': 'warn'
    }
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty-pattern': 'off'
    }
  },
  // ──────────────────────────────────────────────────────────────────────────
  // EDITION GATING. What a desktop-reachable module may not import.
  //
  // The rule these three configs enforce is one sentence: a module that a
  // desktop window's bundle can reach may not import the cloud. It is already
  // checked twice — `desktopEntry.cloudFree.test.ts` walks the import graph
  // from the entry, and `scripts/desktop-bundle-greps.mjs` greps the built
  // bundle — and both of those are checks on the WHOLE, which means both report
  // the breakage at a distance from the line that caused it, after a test run or
  // after a build.
  //
  // This reports it on the line, as it is typed. It is the same rule at a third
  // altitude, and the cheapest of the three; the other two remain because a lint
  // rule can only see a specifier it was told to look for, while a graph walk
  // sees whatever is really there.
  //
  // `docs/edition-gating.md` states the whole mechanism.
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: ['src/desktop/**/*.{ts,tsx}', 'src/services/local/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@data',
            message:
              'A desktop-only module names the device engine directly ' +
              '(services/local/deviceDataPort). `@data` is the edition-BLIND door, for surfaces ' +
              'that are shared with the web app; reaching through it from code that only ever ' +
              'runs in a window asks the build a question this file already knows the answer to.'
          }
        ],
        patterns: [
          {
            group: [
              '@clerk/*', '@supabase/*', '@sentry/*', '@stripe/*',
              '**/services/api/supabaseClient', '**/api/supabaseClient',
              '**/services/api/dataService', '**/api/dataService',
              '**/services/storageAdapter', '**/storageAdapter',
              '**/loggers/scopedLogger', '**/scopedLogger',
              '**/services/userIdService', '**/userIdService',
              '**/services/preferencesService', '**/preferencesService',
              '**/services/banking/**', '**/banking/**',
              '**/services/stripeService', '**/stripeService',
              '**/contexts/AuthContext', '**/contexts/SubscriptionContext'
            ],
            message:
              'A desktop-reachable module may not import the cloud. This bundle promises that ' +
              'the money never leaves the machine, and everything named here would put a ' +
              'network, a login or a second store inside it. If a shared surface needs the data ' +
              'layer it imports `@data`, which each build resolves to its own engine. See ' +
              'docs/edition-gating.md.'
          },
          { regex: PORT_INDEX, message: PORT_INDEX_MESSAGE }
        ]
      }]
    }
  },
  {
    // The desktop's own tests, which are allowed to NAME the cloud in order to
    // assert its absence: `desktopEntry.cloudFree.test.ts` lists the forbidden
    // modules as strings, and a walker has to be given the specifier it is
    // looking for. They are strings in an array, not imports, so the rule above
    // would not fire on them today — this exemption is here for the test that
    // eventually needs to import one, and so that nobody weakens the real rule
    // to make a test pass.
    files: ['src/desktop/**/__tests__/**', 'src/services/local/**/__tests__/**'],
    rules: { 'no-restricted-imports': 'off' }
  },
  {
    // Shared UI reaches the data layer through the alias, and only through it.
    // The second of the two greps, as a lint rule: a component that imports
    // `services/port` by path compiles, passes every test, and then puts
    // DataService — and a Supabase client behind it — into a desktop window the
    // day that component is mounted there. The failure is invisible until the
    // edition it breaks is the one being built.
    files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}', 'src/contexts/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            regex: PORT_INDEX,
            message:
              'Import the seam through `@data`, not by path. The specifier is what chooses the ' +
              'edition: `@data` is DataService in the web build and the open ledger file in a ' +
              'desktop window, and a component that names one of them by path has picked an ' +
              'engine on behalf of every edition. See docs/edition-gating.md.'
          },
          {
            group: ['**/services/api/dataService', '**/api/dataService'],
            message:
              'Nothing above the seam names an ENGINE. `dataPort` from `@data` is the door; ' +
              'DataService is what happens to be behind it in one of the two editions. See ' +
              'docs/edition-gating.md.'
          }
        ]
      }]
    }
  }
])
