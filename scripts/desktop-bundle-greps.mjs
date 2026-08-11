/**
 * PHASE3-PLAN §5's TWO BUNDLE GREPS, as a command.
 *
 *   npm run desktop:greps      (build first: npm run desktop:ui)
 *
 * The plan asks two questions of a desktop build:
 *
 *   1. does it contain a SUPABASE CLIENT?   — the cloud, in a program whose
 *      whole promise is that the money never leaves the machine;
 *   2. does it contain the BROWSER STORAGE ADAPTER? — a second copy of the
 *      ledger, in IndexedDB, on a device that already has one on disk.
 *
 * Both must answer no, and until this file existed both were answered by hand.
 * Slice 27's README says "zero occurrences of … in the built bundle" and that
 * sentence was true when it was written and checkable by nobody afterwards.
 *
 * ── WHY THIS EXISTS BESIDE THE IMPORT-GRAPH TEST, NOT INSTEAD OF IT ─────────
 *
 * `src/services/local/__tests__/deviceDocument.cloudFree.test.ts` and
 * `src/desktop/__tests__/desktopEntry.cloudFree.test.ts` ask the same questions
 * of the import GRAPH, on every test run, on any machine, with no build step.
 * They are the fast check and they name the chain that broke the rule, which is
 * the thing a person actually needs.
 *
 * They cannot be the only check, because they read the source the way a bundler
 * WOULD have read it rather than reading what a bundler DID. Three things can
 * differ: a specifier the walkers resolve differently from Vite (an alias, an
 * index directory, a package export map), a dependency that pulls a cloud SDK
 * of its own, and anything injected by a plugin or by `define`. This reads the
 * artefact that ships.
 *
 * ── THE THREE MORE, AND WHY THEY ARE NOT "THE TWO" ──────────────────────────
 *
 * `clerk` and `sentry` are here too, and `stripe`, because the README already
 * claims them and a claim nobody runs is a claim that decays. They are reported
 * separately from the plan's two so that the pair the plan actually named stays
 * legible — if this ever has to be argued about, it is worth knowing which line
 * is the law and which is the belt.
 *
 * ── IT REFUSES RATHER THAN SKIPS ────────────────────────────────────────────
 *
 * No build, no answer, non-zero exit. The alternative — passing quietly when
 * there is nothing to look at — is how a gate comes to mean nothing, and this
 * repository has already ruled on it once (R-8, in the local contract suite).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(REPO, 'apps', 'desktop', 'dist');

/** The plan's two, and the three the README has been claiming since slice 27. */
const THE_TWO = [
  {
    word: 'supabase',
    is: 'a Supabase client',
    costs: 'the cloud, in a program that promises the file never leaves the machine'
  },
  {
    word: 'storageAdapter',
    is: "the browser's IndexedDB store",
    costs: 'a second copy of the ledger, on a device that already has one'
  }
];

const AND_THREE_MORE = [
  { word: 'indexedDB', is: 'browser storage by another name', costs: 'the same second copy' },
  { word: 'clerk', is: 'the cloud identity provider', costs: 'a sign-in, in an edition whose identity is a file' },
  { word: 'sentry', is: 'error reporting', costs: 'this machine telling a server what went wrong on it' },
  { word: 'stripe', is: 'payments', costs: 'a subscription, in an edition that is not one' }
];

/**
 * A word this bundle MUST contain.
 *
 * Without it the whole check passes on an empty directory, a failed build, or a
 * `dist/` left behind by something else — three ways of grepping nothing and
 * calling it clean. `wealth_core_invoke` is the one Tauri command the ledger
 * crosses; a desktop bundle that does not name it is not a desktop bundle.
 */
const MUST_CONTAIN = 'wealth_core_invoke';

const filesUnder = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, out);
    else out.push(full);
  }
  return out;
};

const say = message => process.stdout.write(`${message}\n`);

if (!existsSync(DIST)) {
  say('');
  say('desktop bundle greps — REFUSED');
  say('');
  say(`  There is no build to look at: ${path.relative(REPO, DIST)} does not exist.`);
  say('  Run `npm run desktop:ui` first. This does not skip, because a grep that');
  say('  passes when there is nothing to grep is worse than no grep at all.');
  say('');
  process.exit(1);
}

const files = filesUnder(DIST);
const sources = files.map(file => ({
  name: path.relative(DIST, file),
  bytes: statSync(file).size,
  text: readFileSync(file, 'utf8')
}));

const occurrences = word => {
  const needle = word.toLowerCase();
  const hits = [];
  for (const source of sources) {
    const count = source.text.toLowerCase().split(needle).length - 1;
    if (count > 0) hits.push({ file: source.name, count });
  }
  return hits;
};

const totalBytes = sources.reduce((sum, source) => sum + source.bytes, 0);

say('');
say('desktop bundle greps — PHASE3-PLAN §5');
say('');
say(`  bundle            ${path.relative(REPO, DIST)}`);
say(`  files             ${sources.length}, ${(totalBytes / 1024).toFixed(1)} kB`);

const failures = [];

if (!sources.some(source => source.text.includes(MUST_CONTAIN))) {
  failures.push(
    `  the bundle does not contain ${MUST_CONTAIN}, so there is nothing here to check.\n` +
      '    Either the build failed or this is not the desktop renderer.'
  );
  say(`  self-check        FAILED — no ${MUST_CONTAIN}`);
} else {
  say(`  self-check        ${MUST_CONTAIN} is present, so the grep has something to read`);
}

const report = (heading, group) => {
  say('');
  say(`  ${heading}`);
  for (const { word, is, costs } of group) {
    const hits = occurrences(word);
    const found = hits.reduce((sum, hit) => sum + hit.count, 0);
    say(`    ${found === 0 ? 'clean' : 'FOUND'}  ${word.padEnd(16)} ${is}`);
    if (found > 0) {
      failures.push(
        `  a desktop build contains ${is} — ${costs}.\n` +
          hits.map(hit => `    ${hit.file}: ${hit.count} occurrence(s) of "${word}"`).join('\n')
      );
    }
  }
};

report('the plan’s two', THE_TWO);
report('and the three more the README claims', AND_THREE_MORE);

say('');
if (failures.length > 0) {
  say('FAIL');
  say('');
  for (const failure of failures) say(failure);
  say('');
  process.exit(1);
}
say('PASS  the desktop bundle reaches no cloud');
say('');
