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

/**
 * Every seam beside `@data`, as their specifiers — the mount slice's six and
 * the two that followed a ruling each.
 *
 * They are listed once and used twice — banned in desktop-only code (which
 * names the device half outright, for the reason `@data` does) and required of
 * shared UI (which may not name either half by path). The messages differ
 * because the two mistakes are different mistakes.
 */
const EDITION_SEAMS = [
  '@chrome',
  '@identity',
  '@prefs-store',
  '@telemetry',
  '@session',
  '@service',
  // …and the seventh, added 1 Sep 2026. `@spreadsheet` is the first seam that is
  // about WEIGHT rather than about the cloud: both halves are perfectly local,
  // and the difference between them is 488 KiB of SheetJS that a desktop binary
  // would embed for a button the owner has ruled it does not have.
  '@spreadsheet',
  // Listed 2 Sep 2026, having been a seam since 28 August: `@rules-store` was
  // declared everywhere a build reads (six configs and the admission harness)
  // and nowhere lint looks, so this one rule alone did not know it existed.
  '@rules-store'
]

/**
 * The CLOUD halves of those six, as a path — `editions/cloud/anything`.
 *
 * A group rather than a regex, unlike `PORT_INDEX`, because there is nothing
 * beneath this directory that a shared surface may legitimately import: the
 * seams' contracts live one level up in `src/editions/`, and a component that
 * wants a type imports it from the specifier along with the value.
 */
const CLOUD_EDITION = ['**/editions/cloud/*', '**/editions/cloud/**']

const CLOUD_EDITION_MESSAGE =
  'This is a seam’s CLOUD half — the Clerk button, the bank feed’s scheduler, the ' +
  '`user_preferences` row, Sentry, the sign-in the state layer waits for, the billing card. ' +
  'Importing it by path picks an edition on behalf of every ' +
  'edition, exactly as importing `services/port` by path does, and the damage appears on the day ' +
  'the importing component is mounted in a window. Import the specifier instead (`@chrome`, ' +
  '`@identity`, `@prefs-store`, `@telemetry`, `@session`, `@service`, `@spreadsheet`, ' +
  '`@rules-store`) and let the build choose. See docs/edition-gating.md.'

/**
 * What a desktop-reachable module may not import, whatever it is.
 *
 * Named so that the two globs below can differ by ONE entry without either of
 * them being a copy of the other. See {@link DATA_LAYER_ONLY}.
 */
const CLOUD_IMPORTS = [
  '@clerk/*', '@supabase/*', '@sentry/*', '@stripe/*',
  '**/services/api/supabaseClient', '**/api/supabaseClient',
  // The app's OWN wrappers around two of those packages, which the patterns
  // above do not match: `lib/sentry` imports `@sentry/react` and `lib/supabase`
  // imports `@supabase/supabase-js`, and a desktop-only module importing either
  // was silent here until a mutation went looking. The graph walks caught it; a
  // lint rule that only bans the package and not the one-line file in front of
  // it is a rule that catches the obvious mistake and not the easy one.
  '**/lib/sentry', '**/lib/supabase',
  '**/services/api/dataService', '**/api/dataService',
  '**/services/storageAdapter', '**/storageAdapter',
  '**/loggers/scopedLogger', '**/scopedLogger',
  '**/services/userIdService', '**/userIdService',
  '**/services/autoSyncService', '**/autoSyncService',
  '**/utils/demoSeed', '**/demoSeed',
  '**/services/banking/**', '**/banking/**',
  '**/services/stripeService', '**/stripeService',
  '**/contexts/AuthContext', '**/contexts/SubscriptionContext',
  // …and the seams' CLOUD halves, which are the same cloud reached through a
  // new door. `editions/cloud/telemetry` is `lib/sentry`; `editions/cloud/chrome`
  // is a Clerk button; `editions/cloud/session` is `useUser()`.
  ...CLOUD_EDITION
]

/**
 * One more ban, and it applies to the DATA LAYER alone.
 *
 * `services/preferencesService.ts` used to be on the list above, because it read
 * a module-scope Supabase client on its second line. `@prefs-store` took that
 * away in the mount slice's first half, and a walk from it now finds six modules
 * and no cloud at all — so as a CLOUD ban it had become false, and worse than
 * false: `contexts/PreferencesContext.tsx` imports it, that context is inside
 * the shared Layout, and the Layout is what a desktop window mounts. The rule
 * banned in `src/desktop/**` a module the desktop bundle already contains.
 *
 * It is still banned in `src/services/local/**`, and for a reason that has
 * nothing to do with the cloud: `deviceDocument.ts` takes the preferences
 * service as an INJECTED structural interface (`DevicePreferences`, two methods)
 * so that the data layer names no app service even in a type position. That is a
 * layering rule, it is still right, and this is where it is held.
 *
 * The injector is the desktop MOUNT — `src/desktop/DesktopApp.tsx` hands over the
 * one singleton every surface renders through — which is precisely the file the
 * old rule made impossible to write.
 */
const DATA_LAYER_ONLY = ['**/services/preferencesService', '**/preferencesService']

// ────────────────────────────────────────────────────────────────────────────
// THE STOCK BLUE. A rule, because five sweeps were not enough.
//
// Claude Design's ruling of 28 August 2026: **the stock blue is retired; links
// keep it, nothing else does.** The colour is roughly #2563eb — Tailwind
// `blue-600` — and it is in no palette this app owns.
//
// What made it a RULE rather than a sixth cleanup is its history. It had
// already been ruled on individually five times: the dark-mode primaries, the
// progress fills, the ToggleSwitch track, the two donut legend labels, and then
// 7,240 reconciliation chips. Four of those five were invisible on the ground
// they broke. A colour that comes back five times is not an oversight, it is a
// missing rule — the same conclusion the `!important` globals reached, where
// the fault was never the instance but that nothing prevented the next one.
//
// The question that decides the shape of the fix: once the hits are cleared, is
// there any legitimate reason for a stock Tailwind blue to enter this codebase
// again? Outside a link, no. So the rule bans the colour everywhere and
// `src/design-system/linkBlue.ts` is the single exemption — one file, which
// owns `LINK_CLASS` and says in its header what a link is. A rule that fails
// the build costs one commit; a sweep that has to be repeated has cost five.
//
// WHAT REPLACES IT, so the error message can say so: the `primary-action` token
// pair for the press being invited, `#94a3b8` (`border-primary` / `ring-primary`,
// which index.css remaps under `.dark`) for selected and on states, and NOTHING
// for a resting state — colour marks what needs attention, and a zero, a count,
// a settled row and a success need none.
// ────────────────────────────────────────────────────────────────────────────

/**
 * A Tailwind blue UTILITY, in any variant stack.
 *
 * Anchored on the utility root rather than on `blue-` alone, so that a palette
 * declaration (`blue: { 500: '#3b82f6' }` in `tokens.ts`) and a measurement
 * table (`tailwindColors.blue[600]` in the contrast checker) are not swept up
 * with the class names. Those files DEFINE the scale; nothing is painted by
 * them. The preceding-character class covers the three places a utility can
 * start: the beginning of the string, after a space in a class list, and after
 * the colon of a variant (`dark:`, `hover:`, `focus-visible:`, `md:`).
 *
 * THE SIDE SUFFIXES ARE NOT DECORATION EITHER. `border-l-blue-500` is a
 * different class from `border-blue-500`, and the first version of this pattern
 * matched only the second — a `border-l-blue-500` rail in `SpendingAlerts.tsx`
 * passed lint while the sweep was actively removing its siblings. One optional
 * group per family that has sides, which is `border` and `divide`.
 */
const STOCK_BLUE_UTILITY =
  '(^|[\\s:])(bg|text|border(-[trblxyse])?|ring(-offset)?|divide-[xy]|from|via|to|fill|stroke|decoration|outline|shadow|placeholder|accent|caret)-blue-[0-9]'

/**
 * …and the same colour spelled out, which is how a class-name rule gets routed
 * around: `dark:bg-[#2563eb]` is `dark:bg-blue-600` with the lint rule filed
 * off. These are Tailwind's blue-400 → blue-900 ramp plus its tints.
 */
const STOCK_BLUE_HEX =
  '#(2563eb|3b82f6|1d4ed8|60a5fa|93c5fd|bfdbfe|dbeafe|eff6ff|1e40af|1e3a8a|172554)'


const STOCK_BLUE_MESSAGE =
  'The stock blue is retired (Claude Design, 28 August 2026). Links keep it and nothing else ' +
  'does — and the one link colour lives in src/design-system/linkBlue.ts, so import LINK_CLASS ' +
  'rather than spelling it again. Everything else has an answer already: a primary button takes ' +
  '`bg-primary-action text-on-primary-action hover:bg-primary-action-hover` (ground-aware, one ' +
  'trio for both themes); a selected or on state takes `border-primary` / `ring-primary`, which ' +
  'index.css remaps to #94a3b8 on dark; a progress fill takes `bg-navy-400 dark:bg-primary-action`; ' +
  'a focus ring takes NOTHING, because this app has one, declared globally. And if what you are ' +
  'colouring is a resting state — a zero, a count, a settled row, a success — the answer is no ' +
  'colour at all. This ruling had to be made five times before it became a rule; please do not ' +
  'make it six.'

/**
 * The selectors, as one list.
 *
 * Both node types are needed and for the same reason twice: `className="…"` and
 * `className={'…'}` are `Literal`s, while `` className={`… ${x}`} `` puts the
 * static half in `TemplateElement`s that a `Literal` selector never sees. The
 * blues that survived the earlier sweeps were disproportionately in template
 * literals, because that is where the conditional — the selected state, the
 * dark variant — gets written.
 *
 * CASE-INSENSITIVE, and that flag is not decoration. Without it the hex half
 * read only lower case, and the sweep of 29 August found five `'#3B82F6'`
 * literals in `pages/settings/Tags.tsx` sitting a single shift key away from
 * the rule — passing lint while spelling the exact colour it bans. A rule that
 * is satisfied by capitalisation is not a rule; it is a naming convention with
 * a build failure attached.
 */
const stockBlueSelectors = (pattern) => [
  { selector: `Literal[value=/${pattern}/i]`, message: STOCK_BLUE_MESSAGE },
  { selector: `TemplateElement[value.raw=/${pattern}/i]`, message: STOCK_BLUE_MESSAGE }
]

/**
 * The whole edition rule for code that only ever runs in a window, given the
 * list of things that code may not reach.
 *
 * A function because there are two such globs and they differ by one entry.
 * Everything else — the specifiers a desktop-only module must NOT reach through
 * (it names the device half outright, for the reason `@data` does), and the
 * choosing file — is identical, and a second copy of it would be the failure
 * this repository keeps finding: a rule one config knows about and another does
 * not.
 */
const editionOnlyImports = (forbidden) => ({
  paths: [
    {
      name: '@data',
      message:
        'A desktop-only module names the device engine directly ' +
        '(services/local/deviceDataPort). `@data` is the edition-BLIND door, for surfaces ' +
        'that are shared with the web app; reaching through it from code that only ever ' +
        'runs in a window asks the build a question this file already knows the answer to.'
    },
    // The mount slice's six, the same rule as `@data`'s. The device halves live
    // in `src/desktop/editions/`, so a module in this glob is either one of them
    // or a neighbour of one, and either way naming the file is shorter, truer
    // and impossible to mis-resolve.
    ...EDITION_SEAMS.map(name => ({
      name,
      message:
        `A desktop-only module names the device half of ${name} directly ` +
        '(src/desktop/editions/…). The specifier is the edition-BLIND door, for surfaces ' +
        'shared with the web app; reaching through it from code that only ever runs in a ' +
        'window asks the build a question this file already knows the answer to.'
    }))
  ],
  patterns: [
    {
      group: forbidden,
      message:
        'A desktop-reachable module may not import the cloud. This bundle promises that ' +
        'the money never leaves the machine, and everything named here would put a ' +
        'network, a login or a second store inside it. If a shared surface needs the data ' +
        'layer it imports `@data`, which each build resolves to its own engine. See ' +
        'docs/edition-gating.md.'
    },
    { regex: PORT_INDEX, message: PORT_INDEX_MESSAGE }
  ]
})

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
  // THE STOCK BLUE BAN. See {@link STOCK_BLUE_UTILITY} for why it is a rule.
  //
  // Class names everywhere under `src/`; the spelled-out hexes everywhere
  // except the three files whose JOB is to write a colour down. Splitting the
  // two patterns is what lets `tokens.ts` keep declaring Tailwind's blue ramp
  // (it is the scale `text-link` is drawn from) while no component may name a
  // rung of it.
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      // The one home for the one blue. Its header is the ruling.
      'src/design-system/linkBlue.ts',
      // Tests name the colour in order to assert its ABSENCE, and the design
      // guards measure it. A rule that fires on its own instruments teaches
      // people to weaken the rule. `src/test/` is the third of those: shared
      // fixtures and the a11y guards, which is test code that simply does not
      // live under a `__tests__` directory.
      '**/__tests__/**',
      '**/*.test.{ts,tsx}',
      'src/test/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...stockBlueSelectors(STOCK_BLUE_UTILITY),
        ...stockBlueSelectors(STOCK_BLUE_HEX)
      ]
    }
  },
  {
    // THE THREE FILES THAT WRITE A COLOUR DOWN AS DATA keep the hex half only.
    //
    // `tokens.ts` DECLARES Tailwind's blue ramp — it is the scale the link
    // colour is drawn from; `accessible-colors.ts` records measured ratios
    // against it; `color-contrast-checker.ts` is the instrument that measures.
    // None of the three paints anything, and a rule that stopped the app from
    // stating what #2563eb is would have stopped it measuring the colour it
    // just banned.
    //
    // The UTILITY half still applies to all three, and that is the important
    // half: `accessible-colors.ts` is exactly where a `'bg-blue-600'` string
    // would go unnoticed — it had one, as `btn-primary`, until this sweep.
    //
    // Restated in full rather than spread by `off`, because flat config takes
    // the LAST matching block's value for a rule: half a rule here would be no
    // rule here.
    files: [
      'src/design-system/tokens.ts',
      'src/design-system/accessible-colors.ts',
      'src/utils/color-contrast-checker.ts'
    ],
    rules: {
      'no-restricted-syntax': ['error', ...stockBlueSelectors(STOCK_BLUE_UTILITY)]
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
    files: ['src/desktop/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', editionOnlyImports(CLOUD_IMPORTS)] }
  },
  {
    // The data layer gets ONE extra ban that the mount does not: see
    // {@link DATA_LAYER_ONLY}. Two entries rather than one glob because the
    // difference between them is a real difference, and folding it away would
    // mean either re-banning a module the desktop bundle legitimately contains
    // or losing the layering rule the injection rests on.
    files: ['src/services/local/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', editionOnlyImports([...CLOUD_IMPORTS, ...DATA_LAYER_ONLY])]
    }
  },
  {
    // THE DEVICE HALVES, and the one thing they must never reach for: the
    // component they are the ALTERNATIVE to.
    //
    // Found by a mutation rather than by argument. `desktop/editions/service.ts`
    // was pointed at the real `components/settings/DangerZone` — the tempting
    // reading, "a desktop danger zone that keeps the delete" — and three
    // instruments went red (the import walk, the bundle grep, the mount test)
    // while lint said nothing, because the ban list above names `@clerk/*` and
    // that file reaches Clerk two modules down. A lint rule can only see a
    // specifier it was told about, and nobody is going to list every shared
    // component a seam might one day replace.
    //
    // So the rule is the other way round: a device half is a REPLACEMENT for
    // shared UI, so it may not import shared UI. It may import React, the local
    // services, and its own contract — which is all any of the six do today.
    // The cloud halves are exempt by construction: they live in
    // `src/editions/cloud/**` and re-binding the shipped component is their
    // entire job.
    files: ['src/desktop/editions/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/components/**', '**/pages/**', '**/contexts/**', '**/hooks/**'],
            message:
              'A device half of an edition seam may not import shared UI. It IS the alternative ' +
              'to a shared surface, so reaching for one means the seam replaced nothing — and ' +
              'the surface it reaches for is, by definition, the one that needed replacing. ' +
              'What a device half may import: React, `src/services/local/**`, and its own ' +
              'contract in `src/editions/`. See docs/edition-gating.md.'
          },
          ...editionOnlyImports(CLOUD_IMPORTS).patterns
        ],
        paths: editionOnlyImports(CLOUD_IMPORTS).paths
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
          },
          { group: CLOUD_EDITION, message: CLOUD_EDITION_MESSAGE }
        ]
      }]
    }
  },
  {
    // The seams' own halves, which name what they are the half OF.
    //
    // `editions/cloud/telemetry.ts` imports `lib/sentry` and that is its entire
    // job; the rule above would ban it, and a rule that has to be argued with is
    // a rule people learn to route around. `src/desktop/editions/**` is left in
    // the desktop glob, where the ban is real and correct.
    files: ['src/editions/cloud/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' }
  }
])
