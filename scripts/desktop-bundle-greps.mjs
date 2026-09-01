/**
 * PHASE3-PLAN §5's TWO BUNDLE GREPS, as a command — and, since 1 Sep 2026, one
 * more that is not about the cloud at all.
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
 * ── AND ONE THAT IS ABOUT WEIGHT, NOT ABOUT THE CLOUD ───────────────────────
 *
 * `xlsx`, from 1 September 2026, in a group of its own. See
 * {@link AND_ONE_ABOUT_WEIGHT} for the ruling behind it and for why it is not
 * folded in with the five above.
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

/**
 * AND THE ONE THAT IS ABOUT WEIGHT — the owner's ruling of 1 September 2026.
 *
 * *"Lose excel is fine as long as they can keep csv."* The desktop edition's
 * Export surfaces offer CSV and PDF and no .xlsx, and `@spreadsheet` is the seam
 * that makes that true of the BUNDLE and not merely of the buttons.
 *
 * ── WHY A GREP AND NOT JUST THE RATCHET ─────────────────────────────────────
 *
 * `desktop-bundle-size.mjs` would notice 488 KiB coming back, but only as a
 * number, only after the budget below it had been re-tightened, and only if
 * nothing else shrank by 488 KiB in the same commit. This names the thing. It
 * also makes the eviction PERMANENT rather than a one-time diet: the way a
 * shed library comes back is somebody adding `await import('xlsx')` to a shared
 * component in six months, which lints clean, typechecks in both projects, and
 * shows up here as one line.
 *
 * ── IT IS ITS OWN GROUP, AND THAT IS THE POINT ──────────────────────────────
 *
 * Every other entry in this file answers *"does this bundle reach a network,
 * a login or a second store?"* — a promise about the user's money. This one
 * answers *"is this bundle carrying a library the product has decided it does
 * not offer?"* — a promise about their disk. Folding the two together would
 * make the first list harder to read and would, the first time somebody
 * shipped a big library on purpose, invite an argument about the wrong rule.
 *
 * ── THE ALLOWANCE, WHICH IS THE STRIPE ALLOWANCE'S SHAPE EXACTLY ────────────
 *
 * `components/DocumentUpload.tsx` accepts a spreadsheet as an ATTACHMENT —
 * `accept="…,.xls,.xlsx"` — so a person can file the invoice their accountant
 * sent them. That is a receipt, not a writer; it is two occurrences of the word
 * in `DocumentManager`'s chunk and it is exactly what this edition is for. The
 * answer is the named allowance the Stripe CSV preset already established, with
 * the same three properties: it names the exact text, it is self-checked by
 * {@link ALLOWANCE_CHECK}, and the run prints what it forgave.
 */
const AND_ONE_ABOUT_WEIGHT = [
  {
    word: 'xlsx',
    is: 'a spreadsheet writer',
    costs:
      "488 KiB of SheetJS embedded in the binary — the renderer's largest chunk — for a format "
      + 'this edition has decided it does not write (owner, 1 Sep 2026)',
    allow: {
      text: '.doc,.docx,.xls,.xlsx',
      why:
        "DocumentUpload's accept list — a person filing a spreadsheet their accountant sent "
        + 'them as an attachment, which is a receipt and not a writer'
    }
  }
];

const AND_THREE_MORE = [
  {
    word: 'wealthtracker_transactions',
    is: "the browser's ledger mirror, by its own storage key",
    costs: 'a second copy of the history, in a program whose whole point is the one on disk'
  },
  {
    pattern: /(?<![a-z0-9])clerk(?![a-z0-9])/i,
    word: 'clerk',
    is: 'the cloud identity provider',
    costs: 'a sign-in, in an edition whose identity is a file'
  },
  {
    pattern: /(?<![a-z0-9])sentry(?![a-z0-9])/i,
    word: 'sentry',
    is: 'error reporting',
    costs: 'this machine telling a server what went wrong on it'
  },
  {
    pattern: /(?<![a-z0-9])stripe(?![a-z0-9])/i,
    word: 'stripe',
    is: 'payments',
    costs: 'a subscription, in an edition that is not one',
    /**
     * THE ONE OCCURRENCE THAT IS NOT PAYMENTS, named rather than grepped around.
     *
     * `enhancedCsvImportService`'s bank presets include a column mapping for a
     * Stripe PAYOUT STATEMENT — `Created (UTC)`, `Available Balance` — in the
     * same list as Monzo, Wise and Coinbase. It arrived in the desktop bundle
     * at slice 31, with `/enhanced-import`, and it is exactly the kind of thing
     * this edition is FOR: a statement a person exports and imports themselves,
     * from a route the product controls, in a program that promises no bank
     * feed.
     *
     * It is also, unmistakeably, the word this grep hunts. So the answer is
     * neither to weaken the pattern (a leak looks like `js.stripe.com`, and a
     * pattern narrowed to that is a pattern that misses the next SDK's own
     * spelling) nor to drop the preset (which would remove a real feature to
     * satisfy a check about a different thing).
     *
     * It is an ALLOWANCE with three properties, and each one is what stops it
     * becoming a way to opt out:
     *
     *   IT NAMES THE EXACT TEXT. Any other stripe occurrence in the same file
     *   still fails, because only these characters are subtracted from the
     *   count.
     *
     *   IT IS SELF-CHECKED. {@link INSTRUMENT_CHECK} asserts that the allowed
     *   text really does contain the word (an allowance that matched nothing
     *   would be silently doing nothing) and that removing it from a leak
     *   sample does NOT hide the leak.
     *
     *   IT IS REPORTED. The run prints how many occurrences it forgave and
     *   where, so a person reading the output sees the exception rather than a
     *   clean line.
     */
    allow: {
      text: 'id:"stripe",label:"Stripe",region:"Payments"',
      why:
        "enhancedCsvImportService's CSV column mapping for a Stripe payout statement — "
        + 'a file a person exports and imports, in the same list as Monzo and Coinbase, '
        + 'and not a payment this program takes'
    }
  }
];

/**
 * WHY `indexedDB` IS NO LONGER ONE OF THESE, AND WHAT REPLACED IT.
 *
 * It was, from slice 27 until the mount slice's second half, and it was right
 * for as long as the only IndexedDB in this renderer WAS the browser's copy of
 * the ledger. The mount put the application in the window and the word stopped
 * meaning that: `services/documentService.ts` keeps receipt images in IndexedDB,
 * that store is browser-local in the WEB edition too, and it is not the ledger,
 * not a network, and not a copy of anything a device already has on disk. A
 * grep that fails on it is telling a person their receipts are a leak.
 *
 * (It DID find two real ones on the way, and both were fixed rather than
 * excused: the PWA offline queue in the frame, which queues writes for a server
 * that does not exist, and the cloud engine's boot-snapshot cache, which the
 * shared state layer was importing in order to empty. `@chrome` took the first;
 * the second moved inside `DataService.wipeAllFinancialData`, where it belongs.)
 *
 * So the word is replaced by the STORAGE KEY the browser's ledger mirror writes
 * under — `wealthtracker_transactions`, from `encryptedStorageService`'s
 * STORAGE_KEYS. That is a tighter check than the API name, not a looser one: it
 * fails on the browser ledger arriving through `storageAdapter`, through
 * `localBackupService`, or through anything else that has not been invented
 * yet, and it cannot be satisfied by a receipt.
 *
 * The remaining debt is real and is recorded rather than grepped for: a
 * device's attachments live in the WebView's store, so they do not travel with
 * the ledger file and are not in its backup. That is a product gap this edition
 * INHERITS (the web app's receipts do not travel between browsers either), and
 * it belongs in a slice about documents, not in a grep.
 *
 * WHY THE OTHER THREE ARE PATTERNS AND THE FIRST TWO ARE NOT.
 *
 * `supabase` and `storageAdapter` are the plan's two and they stay maximally
 * sensitive: they are distinctive strings that appear nowhere by accident, and
 * `supabaseClient` must match, which a word boundary would forbid.
 *
 * The three vendors are the opposite problem. Their names are ordinary English
 * inside other words, and a renderer that now contains a charting library, a PDF
 * writer and a spreadsheet writer contains a great many of them: `striped` and
 * `gridstripes` and `HorzStripe` in three separate chunks, and `adminClerkId` in
 * our own banking query builder. Measured on the first mounted build: seven
 * false positives, zero true ones. A word-boundary match still finds
 * `js.stripe.com`, `clerk.accounts.dev` and `window.Sentry`, which is what a
 * leak actually looks like — and {@link INSTRUMENT_CHECK} makes that claim
 * executable rather than asserted.
 *
 * The boundary is `(?<![a-z0-9])…(?![a-z0-9])` and NOT `\b`, which is a
 * distinction the self-check found within a minute of being written: `\b`
 * treats `_` as a word character, and Clerk's own bundle names its cookie
 * `__clerk_db_jwt`. A boundary that misses the vendor's own token is exactly the
 * over-narrowing this whole apparatus is here to prevent.
 */

/**
 * The patterns, checked against real leaks and known innocents before they are
 * trusted.
 *
 * A grep that has been narrowed is a grep that can have been narrowed too far,
 * and the failure mode is silence. So each pattern is run over a sample of the
 * thing it is hunting and a sample of the thing it must ignore, and this script
 * REFUSES if any of them is wrong — the same ruling the missing-build case
 * already carries.
 */
const INSTRUMENT_CHECK = [
  { word: 'clerk', finds: ['https://clerk.accounts.dev/npm/@clerk/clerk-js', '__clerk_db_jwt'], ignores: ['adminClerkId', 't.adminClerkId'] },
  { word: 'sentry', finds: ['window.Sentry?.captureException', '@sentry/react'], ignores: ['sentryish', 'presentry'] },
  { word: 'stripe', finds: ['https://js.stripe.com/v3', 'new Stripe(k)'], ignores: ['striped', 'gridstripes', 'HorzStripe:"darkHorizontal"'] },
  // `xlsx` is a plain word rather than a pattern — it is distinctive and it
  // never occurs inside another one — so what is checked here is the ALLOWANCE
  // rather than a narrowing. The three `finds` are the three shapes the library
  // actually arrives in: the chunk's own filename, SheetJS's default bookType,
  // and its own named writer. The `ignores` are the attachment list this
  // edition legitimately carries, and two spreadsheet MIME types that do not
  // spell the word at all and must not start to.
  {
    word: 'xlsx',
    finds: ['import("./xlsx-kWF--8k_.js")', 'bookType:"xlsx"', 'writeFileXLSX'],
    ignores: ['.doc,.docx,.xls,.xlsx', 'application/vnd.ms-excel', 'spreadsheetml.sheet']
  }
];

/**
 * Every entry, whatever group it is in.
 *
 * The two loops that check the INSTRUMENT — the allowances, and the blunting
 * check — must reach all of them, and both used to name one group by hand. That
 * is the failure this repository keeps finding written down in the file it
 * would occur in: a third group would have been added to the report and to
 * neither loop, and its allowance would have gone unchecked in silence.
 */
const EVERY_ENTRY = [...THE_TWO, ...AND_THREE_MORE, ...AND_ONE_ABOUT_WEIGHT];

/**
 * An allowance is only safe if it really matches, and only honest if it cannot
 * hide anything else.
 *
 * Both halves are checked here, for {@link INSTRUMENT_CHECK}'s reason one level
 * up: an allowance that matched nothing would forgive nothing and read as though
 * it had, and an allowance broad enough to swallow a real leak would be the
 * over-narrowing this whole apparatus exists to prevent — arriving by a
 * different door.
 */
const ALLOWANCE_CHECK = entry => {
  const problems = [];
  const { allow, pattern, word } = entry;
  if (!allow) return problems;
  const matcher = pattern ?? new RegExp(word, 'i');
  if (!matcher.test(allow.text)) {
    problems.push(
      `the ${word} allowance does not contain the word it forgives, so it forgives nothing: ` +
        `"${allow.text}"`
    );
  }
  for (const leak of INSTRUMENT_CHECK.find(check => check.word === word)?.finds ?? []) {
    if (leak.split(allow.text).length - 1 > 0) {
      problems.push(`the ${word} allowance would hide a real leak: "${leak}"`);
    }
  }
  return problems;
};

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

/**
 * How many occurrences a file really has, with a named allowance subtracted.
 *
 * The allowance is removed from the TEXT before counting rather than from the
 * count afterwards, so an allowed string cannot mask an unallowed one that
 * happens to sit beside it — and so the arithmetic is a property of the input
 * rather than a subtraction somebody has to get right.
 */
const countIn = (text, entry) => {
  const readable = entry.allow ? text.split(entry.allow.text).join('') : text;
  if (entry.pattern) return (readable.match(new RegExp(entry.pattern.source, 'gi')) ?? []).length;
  return readable.toLowerCase().split(entry.word.toLowerCase()).length - 1;
};

/** How many occurrences an allowance forgave, so the run can say so out loud. */
const forgivenIn = (text, entry) => {
  if (!entry.allow) return 0;
  const removed = text.split(entry.allow.text).length - 1;
  if (removed === 0) return 0;
  const matcher = new RegExp(entry.pattern?.source ?? entry.word, 'gi');
  return removed * ((entry.allow.text.match(matcher) ?? []).length);
};

const occurrences = entry => {
  const hits = [];
  for (const source of sources) {
    const count = countIn(source.text, entry);
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

// The allowances, before anything is grepped: one that matches nothing, or one
// broad enough to swallow a real leak, would make every line below a lie.
for (const entry of EVERY_ENTRY) {
  for (const problem of ALLOWANCE_CHECK(entry)) failures.push(`  ${problem}`);
}

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
  for (const entry of group) {
    const { word, is, costs } = entry;
    const hits = occurrences(entry);
    const found = hits.reduce((sum, hit) => sum + hit.count, 0);
    const forgiven = sources.reduce((sum, source) => sum + forgivenIn(source.text, entry), 0);
    const note = forgiven > 0 ? ` (${forgiven} allowed: ${entry.allow.why})` : '';
    say(`    ${found === 0 ? 'clean' : 'FOUND'}  ${word.padEnd(26)} ${is}${note}`);
    if (found > 0) {
      failures.push(
        `  a desktop build contains ${is} — ${costs}.\n` +
          hits.map(hit => `    ${hit.file}: ${hit.count} occurrence(s) of "${word}"`).join('\n')
      );
    }
  }
};

// THE INSTRUMENT, BEFORE THE ARTEFACT. A narrowed pattern that no longer finds
// the thing it is for reports green on a leaking bundle, which is the one way
// this script can be worse than not existing.
const blunted = [];
for (const { word, finds, ignores } of INSTRUMENT_CHECK) {
  const entry = EVERY_ENTRY.find(candidate => candidate.word === word);
  if (entry === undefined) {
    blunted.push(`  '${word}' is self-checked but is not grepped for by anything`);
    continue;
  }
  for (const sample of finds) {
    if (countIn(sample, entry) === 0) blunted.push(`  '${word}' no longer finds ${JSON.stringify(sample)}`);
  }
  for (const sample of ignores) {
    if (countIn(sample, entry) > 0) blunted.push(`  '${word}' still matches ${JSON.stringify(sample)}`);
  }
}
if (blunted.length > 0) {
  say('');
  say('desktop bundle greps — REFUSED');
  say('');
  say('  The instrument is wrong, so nothing it says about the bundle is worth reading:');
  for (const line of blunted) say(line);
  say('');
  process.exit(1);
}

report('the plan’s two', THE_TWO);
report('and the four more the README claims', AND_THREE_MORE);
report('and the one that is about weight, not the cloud', AND_ONE_ABOUT_WEIGHT);

say('');
if (failures.length > 0) {
  say('FAIL');
  say('');
  for (const failure of failures) say(failure);
  say('');
  process.exit(1);
}
say('PASS  the desktop bundle reaches no cloud, and carries no spreadsheet writer');
say('');
