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
 * ── WHAT THIS IS ACTUALLY GUARDING AGAINST ──────────────────────────────────
 *
 * One specific future event. The renderer is 259 KiB today because it mounts a
 * chooser and a ledger screen. `docs/edition-gating.md` records the measurement
 * that says what happens next: a runtime import walk from `components/Layout`
 * reaches 144 modules and five independent cloud roots. When the app's screens
 * are mounted in the window — the next programme of work — they arrive through
 * that graph, and they arrive all at once.
 *
 * `desktop:greps` catches the part of that arrival which is a broken promise (a
 * Supabase client, browser storage, Clerk). It cannot catch the part which is
 * merely enormous: a renderer that doubled in size while staying perfectly
 * cloud-free passes every check this repository had before this file. That is
 * the gap, and 25 KiB of headroom is how wide it is allowed to be before
 * somebody has to make the growth a deliberate decision rather than a diff.
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
 * BASELINE, measured 2026-08-12 at slice 30 on `npm run desktop:ui`:
 *
 *   assets/index-*.js    263,715 raw   87,730 gzip
 *   assets/index-*.css       721 raw      412 gzip
 *   index.html             1,127 raw      631 gzip
 *   ──────────────────────────────────────────────
 *   total                265,563 raw   88,773 gzip
 *                       (259.3 KiB)   (86.7 KiB)
 *
 * React, React DOM and the router, mounted (slice 29). It was 81.8 kB raw when
 * it was one screen of vanilla DOM, which is the last time this number moved
 * for a reason anybody would recognise a year later.
 *
 * Budgets are ~10% above that. Lower them if the renderer ever gets smaller;
 * raising them is allowed, but it is a decision that belongs in a commit
 * message — not a number quietly nudged until the build goes green.
 */
const BASELINE_TOTAL_RAW_KIB = 259.3;
const BASELINE_TOTAL_GZIP_KIB = 86.7;

const MAX_TOTAL_RAW_KIB = Number(process.env.DESKTOP_MAX_TOTAL_RAW_KIB ?? 285);
const MAX_TOTAL_GZIP_KIB = Number(process.env.DESKTOP_MAX_TOTAL_GZIP_KIB ?? 96);

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
