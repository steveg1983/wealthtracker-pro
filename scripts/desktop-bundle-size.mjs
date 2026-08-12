#!/usr/bin/env node

/**
 * THE DESKTOP RENDERER'S SIZE RATCHET.
 *
 *   npm run bundle:check:desktop     (build first: npm run desktop:ui)
 *
 * `scripts/bundle-size-check.mjs` does this for the web build. This is the same
 * instrument with the same shape — budgets as constants, a measured baseline
 * recorded beside them, an env override for experiments, non-zero exit when a
 * budget is passed — pointed at `apps/desktop/dist` and answering to different
 * numbers, for a different reason.
 *
 * ── WHY RAW BYTES ARE THE GATE HERE, AND GZIP IS NOT THE HEADLINE ───────────
 *
 * The web gate measures gzip because gzip is what a browser downloads: it is
 * the number a person waits for. NOTHING IS DOWNLOADED HERE. `tauri.conf.json`
 * names `apps/desktop/dist` as `frontendDist` and `tauri::generate_context!`
 * embeds those files into the binary at compile time, so the bytes this build
 * emits are bytes on the user's disk and bytes the WebView parses when the
 * window opens. Compression never enters it.
 *
 * So RAW is the number with a consequence and it is the one that fails a build.
 * Gzip is measured and budgeted anyway, two reasons: `apps/desktop/README.md`
 * has been quoting a gzip figure since slice 29 and a quoted number nobody runs
 * is a number that decays, and it is the only figure directly comparable with
 * the web bundle's — the two editions ship the same components eventually, and
 * the day that comparison matters it should not have to be re-derived.
 *
 * ── WHAT THIS IS ACTUALLY GUARDING AGAINST, AND WHAT IT HAS ALREADY SEEN ────
 *
 * One specific future event, and it happened one slice after this file was
 * written. Slice 30's note said:
 *
 * > The renderer is 259 KiB today because it mounts a chooser and a ledger
 * > screen. … When the app's screens are mounted in the window — the next
 * > programme of work — they arrive through that graph, and they arrive all at
 * > once.
 *
 * They did. The mount slice's second half took the renderer from 259.3 KiB to
 * **3,273.1 KiB raw** — 12.6x — in one commit, and every byte of it was
 * intended. That is exactly the event this file exists to make somebody look at
 * rather than discover, and looking at it is what produced the note below.
 *
 * `desktop:greps` catches the part of an arrival which is a broken promise (a
 * Supabase client, browser storage, Clerk). It cannot catch the part which is
 * merely enormous: a renderer that doubled in size while staying perfectly
 * cloud-free passes every other check in this repository.
 *
 * ── IT REFUSES RATHER THAN SKIPS ────────────────────────────────────────────
 *
 * No build, no answer, non-zero exit — the same ruling `desktop:greps` and the
 * local contract suite already carry (R-8). A size gate that passes because it
 * measured an empty directory is a gate that reports green on a failed build.
 *
 * ── THE BINARY IS RECORDED AND NEVER GATED ──────────────────────────────────
 *
 * The 16 MB figure in `apps/desktop/README.md` was measured by hand once. This
 * prints it when there is a binary to read, so it stops being a claim. It is
 * NOT a budget, and must not become one here, because its size is a function of
 * the toolchain, the platform and the profile: CI's Linux binary and a
 * developer's arm64 macOS binary are different artefacts and neither is the
 * other's regression. A binary budget belongs to a release job that builds one
 * target, not to a check that runs wherever it is run.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(REPO, 'apps', 'desktop', 'dist');
const BINARY = path.join(REPO, 'apps', 'desktop', 'src-tauri', 'target', 'release', 'wealthtracker-desktop');

/**
 * BASELINE, re-measured 2026-08-12 at the mount slice's second half, on
 * `npm run desktop:ui`. 101 files; the ten that matter:
 *
 *   xlsx-*.js                     488.0 KiB raw   158.9 KiB gzip
 *   jspdf.es.min-*.js             377.0 KiB       123.1 KiB
 *   MountedLedger-*.js            306.3 KiB        90.9 KiB
 *   CategoricalChart-*.js         274.0 KiB        84.2 KiB   (recharts)
 *   index-*.js                    231.1 KiB        76.1 KiB   (React, the router, the entry)
 *   html2canvas.esm-*.js          196.7 KiB        46.1 KiB
 *   index.es-*.js                 154.9 KiB        51.5 KiB
 *   EditTransactionModal-*.js     120.3 KiB        33.5 KiB
 *   AccountTransactions-*.js       91.0 KiB        27.1 KiB
 *   Categories-*.js                89.1 KiB        27.9 KiB
 *   …and 91 more
 *   ──────────────────────────────────────────────
 *   total                       3,273.1 KiB     1,006.5 KiB
 *
 * THE PREVIOUS BASELINE WAS 259.3 KiB RAW / 86.7 KiB GZIP, and it was a window
 * that mounted a file chooser. This one is the application: 348 modules from the
 * entry, thirty-six routes, every page the web app serves except three that are
 * named and owed. The multiple is 12.6x and it is not a regression — there was
 * nothing here before.
 *
 * ── WHY THE NEW BUDGETS ARE WHERE THEY ARE ──────────────────────────────────
 *
 * ~10% above measured, which is the convention this file already had, and the
 * convention matters more than the number: it is tight enough that the NEXT
 * accidental arrival fails, which is the only job a ratchet has.
 *
 * ── WHAT SHOULD MAKE IT SMALLER, IN ORDER, AND WHY NOT IN THIS SLICE ────────
 *
 * The four biggest chunks are 1,335 KiB — 41% of the renderer — and not one of
 * them is this edition's own code:
 *
 *   xlsx + jspdf + html2canvas   1,062 KiB. Excel and PDF export. All three are
 *                                already lazy, all three are reachable from the
 *                                Export page, and `docs/bundle-optimization-plan
 *                                .md` has had them on the WEB app's list for
 *                                months. Whatever fixes them there fixes them
 *                                here, and doing it here first would be fixing
 *                                the smaller of two identical problems.
 *   recharts                     274 KiB, and the repo's own audit note says the
 *                                web build ships recharts AND chart.js. Picking
 *                                one is a design decision about every chart in
 *                                the product, not a desktop packaging chore.
 *
 * So: measured, recorded, budgeted, and pointed at the slice that should
 * actually do it. Lower these the day one of those lands. Raising them further
 * is allowed and is a decision that belongs in a commit message — not a number
 * quietly nudged until the build goes green.
 */
const BASELINE_TOTAL_RAW_KIB = 3273.1;
const BASELINE_TOTAL_GZIP_KIB = 1006.5;

const MAX_TOTAL_RAW_KIB = Number(process.env.DESKTOP_MAX_TOTAL_RAW_KIB ?? 3600);
const MAX_TOTAL_GZIP_KIB = Number(process.env.DESKTOP_MAX_TOTAL_GZIP_KIB ?? 1110);

const isReport = process.argv.includes('--report');

const say = message => process.stdout.write(`${message}\n`);
const kib = bytes => `${(bytes / 1024).toFixed(1)} KiB`;

const filesUnder = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) filesUnder(full, out);
    else out.push(full);
  }
  return out;
};

if (!fs.existsSync(DIST)) {
  say('');
  say('desktop bundle size — REFUSED');
  say('');
  say(`  There is no build to measure: ${path.relative(REPO, DIST)} does not exist.`);
  say('  Run `npm run desktop:ui` first. This does not skip, because a size gate');
  say('  that passes when there is nothing to weigh reports green on a failed build.');
  say('');
  process.exit(1);
}

const assets = filesUnder(DIST)
  .map(file => {
    const bytes = fs.readFileSync(file);
    return {
      name: path.relative(DIST, file),
      raw: bytes.length,
      gzip: zlib.gzipSync(bytes, { level: 9 }).length
    };
  })
  .sort((a, b) => b.raw - a.raw);

if (assets.length === 0) {
  say('');
  say('desktop bundle size — REFUSED');
  say('');
  say(`  ${path.relative(REPO, DIST)} exists but is empty. The build did not emit anything.`);
  say('');
  process.exit(1);
}

const totalRaw = assets.reduce((sum, asset) => sum + asset.raw, 0);
const totalGzip = assets.reduce((sum, asset) => sum + asset.gzip, 0);
const largest = assets[0];

const drift = (measuredKib, baselineKib) => {
  const delta = measuredKib - baselineKib;
  if (Math.abs(delta) < 0.05) return 'on baseline';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} KiB vs baseline ${baselineKib} KiB`;
};

say('');
say('desktop renderer size — the bytes the binary embeds');
say('');
say(`  bundle            ${path.relative(REPO, DIST)}`);
say(`  files             ${assets.length}`);
say(`  largest           ${kib(largest.raw)} raw  ${largest.name}`);
say('');
say(`  total raw         ${kib(totalRaw).padStart(10)}   budget ${MAX_TOTAL_RAW_KIB} KiB   ${drift(totalRaw / 1024, BASELINE_TOTAL_RAW_KIB)}`);
say(`  total gzip        ${kib(totalGzip).padStart(10)}   budget ${MAX_TOTAL_GZIP_KIB} KiB   ${drift(totalGzip / 1024, BASELINE_TOTAL_GZIP_KIB)}`);

if (isReport) {
  say('');
  say('  per file (raw / gzip)');
  for (const asset of assets) {
    say(`    ${kib(asset.raw).padStart(10)}  ${kib(asset.gzip).padStart(10)}  ${asset.name}`);
  }
}

say('');
if (fs.existsSync(BINARY)) {
  const bytes = fs.statSync(BINARY).size;
  // MiB, to match the KiB above. The README's "16 MB" was the same bytes in
  // decimal units; both are printed so neither reading looks like a regression.
  say(
    `  binary            ${(bytes / 1024 / 1024).toFixed(1)} MiB ` +
      `(${(bytes / 1e6).toFixed(1)} MB)  ${path.relative(REPO, BINARY)}`
  );
  say('                    recorded, never gated — its size is a function of the');
  say('                    toolchain and the platform, so two machines disagree');
  say('                    without either of them having regressed.');
} else {
  say('  binary            not built here (npm run desktop:build) — nothing to record.');
  say('                    This is not a failure: the renderer is what this gate weighs.');
}

const failures = [];
if (totalRaw > MAX_TOTAL_RAW_KIB * 1024) {
  failures.push(
    `total raw ${kib(totalRaw)} exceeds budget ${MAX_TOTAL_RAW_KIB} KiB.\n` +
      '    Raw is the gate here because nothing is downloaded: these bytes are\n' +
      '    embedded in the binary and parsed when the window opens.'
  );
}
if (totalGzip > MAX_TOTAL_GZIP_KIB * 1024) {
  failures.push(`total gzip ${kib(totalGzip)} exceeds budget ${MAX_TOTAL_GZIP_KIB} KiB.`);
}

say('');
if (failures.length > 0) {
  say('FAIL  the desktop renderer grew past its ratchet');
  say('');
  for (const failure of failures) say(`  - ${failure}`);
  say('');
  say('  If a module arrived by accident, `npm run desktop:ui` names it: build with');
  say('  the renderer config and read what the 59-module graph turned into.');
  say('  If the growth is intended, raise the budget in this file deliberately and');
  say('  say why in the commit — that is the whole difference between a ratchet and');
  say('  a number that drifts.');
  say('');
  process.exit(1);
}
say('PASS  the desktop renderer is within its ratchet');
say('');
