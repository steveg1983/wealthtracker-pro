#!/usr/bin/env node
// Phase 1 port-coverage gate.
//
// Discovery finds every money-handling file mechanically; manifest.json records
// what has been decided about each one. This script fails if the two disagree.
// It replaces "how many invariants are there" — a number three audits could not
// make stand still — with "which files are dispositioned", which is monotone
// and cannot be gamed by merging or splitting table rows.
//
//   npm run port:coverage                 the gate
//   npm run port:coverage -- --pending    the work queue, by directory
//   npm run port:coverage -- --why=<path> why a file was discovered
//   npm run port:coverage -- --heuristics what each heuristic caught
//   npm run port:coverage -- --json       machine-readable
//
// Exit 1 on any disagreement, 2 on a usage error. Node built-ins only.

import fs from 'node:fs';
import path from 'node:path';
import { discover, REPO_ROOT, SCOPE_ROOTS } from './lib/discovery.mjs';
import { loadManifest, validateEntries, toleratesAbsence, STATUSES, MANIFEST_PATH } from './lib/manifest.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const unknown = argv.filter((a) => !/^--(pending|json|heuristics|help|why=.*)$/.test(a));
if (unknown.length > 0 || flag('help')) {
  const stream = flag('help') ? process.stdout : process.stderr;
  const lines = ['usage: node scripts/port-coverage/run.mjs [--pending] [--why=<path>] [--heuristics] [--json]'];
  if (unknown.length > 0) lines.push(`unknown argument(s): ${unknown.join(' ')}`);
  stream.write(`${lines.join('\n')}\n`);
  process.exit(flag('help') ? 0 : 2);
}

const out = (line = '') => process.stdout.write(`${line}\n`);

const result = discover(REPO_ROOT);
const manifest = loadManifest();

// ---------------------------------------------------------------- reconcile
const discovered = new Set(result.files.keys());
const entries = manifest.files;

const missing = [...discovered].filter((file) => !Object.hasOwn(entries, file)).sort();

const staleGone = [];
const staleNotMoney = [];
for (const [file, entry] of Object.entries(entries).sort()) {
  if (discovered.has(file)) continue;
  const exists = fs.existsSync(path.join(REPO_ROOT, file));
  if (!exists) {
    if (!toleratesAbsence(entry)) staleGone.push(file);
  } else if (entry.discovery !== 'manual') {
    staleNotMoney.push(file);
  }
}

const structural = validateEntries(manifest);

const byStatus = new Map(Object.keys(STATUSES).map((s) => [s, []]));
for (const [file, entry] of Object.entries(entries)) {
  if (byStatus.has(entry.status)) byStatus.get(entry.status).push(file);
}
const pending = byStatus.get('pending') ?? [];
const pendingCited = pending.filter((f) => (entries[f].cited_by ?? []).length > 0);
const pendingUncited = pending.filter((f) => (entries[f].cited_by ?? []).length === 0);
const manual = Object.entries(entries).filter(([, e]) => e.discovery === 'manual').map(([f]) => f);

const failed = missing.length > 0 || staleGone.length > 0 || staleNotMoney.length > 0 || structural.length > 0;

/** Counts per containing directory: total, and how many no audit ever named. */
function group(files) {
  const buckets = new Map();
  for (const file of files) {
    const dir = file.slice(0, file.lastIndexOf('/'));
    if (!buckets.has(dir)) buckets.set(dir, { total: 0, uncited: 0 });
    const bucket = buckets.get(dir);
    bucket.total += 1;
    if ((entries[file].cited_by ?? []).length === 0) bucket.uncited += 1;
  }
  return [...buckets.entries()].sort((a, b) => b[1].total - a[1].total || (a[0] < b[0] ? -1 : 1));
}

// -------------------------------------------------------------------- views
if (flag('json')) {
  out(JSON.stringify({
    discovered: discovered.size,
    manifest: Object.keys(entries).length,
    manual: manual.length,
    byStatus: Object.fromEntries([...byStatus].map(([s, f]) => [s, f.length])),
    pendingCited: pendingCited.length,
    pendingUncited: pendingUncited.length,
    missing,
    staleGone,
    staleNotMoney,
    structural,
    heuristics: result.heuristics.map(({ id, count }) => ({ id, count })),
    vocabulary: {
      migrations: result.vocabulary.migrationCount,
      moneyTables: result.vocabulary.moneyTables,
      moneyFunctions: result.vocabulary.moneyFunctions,
    },
    pass: !failed,
  }, null, 2));
  process.exit(failed ? 1 : 0);
}

const why = value('why');
if (why !== undefined) {
  const key = why.replace(/^\.\//, '');
  const hit = result.files.get(key);
  out();
  out(`  ${key}`);
  if (!hit) {
    out('    not discovered — no heuristic matched, or the path is outside the scope roots');
    out(`    scope roots: ${SCOPE_ROOTS.join(', ')}`);
  } else {
    out(`    signals: ${hit.signals.join(', ')}`);
    const importers = result.importedByMoney.get(key);
    if (importers) out(`    imported by: ${[...importers].sort().join(', ')}`);
  }
  const entry = entries[key];
  out(`    manifest: ${entry ? JSON.stringify(entry) : 'ABSENT'}`);
  out();
  process.exit(hit && entry ? 0 : 1);
}

out();
out('port-coverage — every money-handling file must be dispositioned');
out();
out(`  scope roots       ${SCOPE_ROOTS.join(', ')}`);
out(`  schema vocabulary ${result.vocabulary.moneyTables.length} money tables, ${result.vocabulary.moneyFunctions.length} money functions, derived from ${result.vocabulary.migrationCount} migrations`);
out(`  candidates        ${result.candidates} files in scope (${result.excluded.map((e) => `${e.count} ${e.id}`).join(', ')} excluded)`);
out(`  discovered        ${discovered.size}`);
out(`  manifest          ${Object.keys(entries).length} entries${manual.length > 0 ? ` (${manual.length} manual)` : ''}`);
out();
out('  status         files   meaning');
out('  ------------   -----   -------');
for (const [status, files] of byStatus) {
  out(`  ${status.padEnd(12)}   ${String(files.length).padStart(5)}   ${STATUSES[status].split('.')[0]}`);
}
out();
out(`  of the ${pending.length} pending: ${pendingCited.length} cited by an audit, ${pendingUncited.length} cited by none`);
out('  (the uncited half is AUDIT3 §0.1\'s 52% — a work queue, not an embarrassment)');
out();

if (flag('heuristics')) {
  out('  heuristic                  files   why');
  out('  ------------------------   -----   ---');
  for (const h of result.heuristics) {
    out(`  ${h.id.padEnd(24)}   ${String(h.count).padStart(5)}   ${h.why}`);
  }
  out();
  out('  exclusions applied before any heuristic ran:');
  for (const e of result.excluded) out(`    ${e.id} (${e.count}) — ${e.why}`);
  out();
}

out('  pending, by directory');
for (const [dir, bucket] of group(pending)) {
  out(`    ${dir.padEnd(30)} ${String(bucket.total).padStart(4)}   (${bucket.uncited} cited by no audit)`);
}
out();

if (flag('pending')) {
  out('  pending, in full');
  for (const file of pending.sort()) {
    const ids = entries[file].ids ?? [];
    out(`    ${file}${ids.length > 0 ? `   ${ids.join(' ')}` : ''}`);
  }
  out();
}

if (structural.length > 0) {
  out(`  MANIFEST INVALID — ${structural.length} malformed ${structural.length === 1 ? 'entry' : 'entries'}`);
  for (const problem of structural) out(`    ${problem}`);
  out();
}

if (missing.length > 0) {
  out(`  UNDISPOSITIONED — ${missing.length} discovered ${missing.length === 1 ? 'file is' : 'files are'} absent from the manifest`);
  for (const file of missing) out(`    ${file}`);
  out();
  out(`  Add each one to ${path.relative(REPO_ROOT, MANIFEST_PATH)} with a status.`);
  out('  `--why=<path>` explains why discovery picked it up.');
  out();
}

if (staleGone.length > 0) {
  out(`  VANISHED — ${staleGone.length} manifest ${staleGone.length === 1 ? 'entry names a path that does' : 'entries name paths that do'} not exist`);
  for (const file of staleGone) out(`    ${file}`);
  out();
  out('  Re-point the entry at the new path, or keep the entry and set');
  out('  status "out-of-scope" with a reason starting "deleted:", "moved-to:" or');
  out('  "superseded-by:". The manifest is not allowed to forget a file.');
  out();
}

if (staleNotMoney.length > 0) {
  out(`  NO LONGER DISCOVERED — ${staleNotMoney.length} ${staleNotMoney.length === 1 ? 'file exists but matches' : 'files exist but match'} no heuristic`);
  for (const file of staleNotMoney) out(`    ${file}`);
  out();
  out('  Either the file genuinely stopped handling money — keep the entry and add');
  out('  "discovery": "manual" so it stays visible — or a heuristic regressed.');
  out();
}

out(failed ? 'FAIL' : 'PASS  discovery and manifest agree');
out();
process.exit(failed ? 1 : 0);
