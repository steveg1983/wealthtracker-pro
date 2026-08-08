#!/usr/bin/env node
// Differential constraint harness: the local edition's SQLite schema against the
// cloud's Postgres, one declarative invariant per spec, both engines, same
// operations.
//
//   node scripts/local-sqlite/run.mjs                  both engines
//   node scripts/local-sqlite/run.mjs --engine=sqlite  SQLite only (acknowledged partial run)
//   node scripts/local-sqlite/run.mjs --filter=s5      only specs whose id contains "s5"
//   node scripts/local-sqlite/run.mjs --list           list the specs and stop
//
// Postgres needs the existing cluster: bash scripts/local-db/up.sh

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadSpecs, ENGINES } from './lib/specs.mjs';
import { SqliteEngine } from './lib/sqlite.mjs';
import { PostgresEngine } from './lib/postgres.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const engineArg = arg('engine', 'both');
const filter = arg('filter', undefined);
const listOnly = argv.includes('--list');

if (!['both', 'sqlite', 'postgres'].includes(engineArg)) {
  process.stdout.write(`unknown --engine=${engineArg}\n`);
  process.exit(2);
}

const pad = (text, width) => String(text).padEnd(width);
const out = (line = '') => process.stdout.write(`${line}\n`);

function systemSqliteVersion() {
  try {
    return execFileSync('sqlite3', ['--version'], { encoding: 'utf8' }).trim().split(' ')[0];
  } catch {
    return 'not installed';
  }
}

/** Compare one engine's result against what the spec said that engine would do. */
function judge(spec, engine, result) {
  const expect = spec[engine].expect;
  const problems = [];
  if (result.outcome !== expect.outcome) {
    problems.push(`expected ${expect.outcome}, got ${result.outcome}${result.message ? `: ${firstLine(result.message)}` : ''}`);
  } else if (expect.outcome === 'refused' && !result.message.includes(expect.message)) {
    // The right rule has to fire, not just any error.
    problems.push(`refusal did not name "${expect.message}": ${firstLine(result.message)}`);
  }
  for (const entry of spec.verify ?? []) {
    if (!result.verify.has(entry.name)) continue;
    const wanted = typeof entry.expect === 'string' ? entry.expect : entry.expect[engine];
    const got = result.verify.get(entry.name);
    if (got !== wanted) problems.push(`${entry.name}: expected ${wanted}, got ${got}`);
  }
  return problems;
}

function firstLine(text) {
  const line = String(text).split('\n').find((l) => l.trim() !== '') ?? '';
  // psql prefixes every error with the script path and line number. That is the
  // harness's own temp file — noise, and it changes every run.
  return line.trim().replace(/^psql:[^:]*:\d+:\s*/, '').slice(0, 160);
}

/** The name of the rule that refused, when the engine gives one. */
function refusalName(message) {
  const line = firstLine(message);
  const named = line.match(/constraint "([^"]+)"/)
    ?? line.match(/(?:CHECK|UNIQUE|FOREIGN KEY|NOT NULL) constraint failed: ([\w.,\s]+)/)
    ?? line.match(/duplicate key value violates unique constraint "([^"]+)"/);
  if (named) return named[1].trim();
  return line.replace(/^ERROR:\s*/, '').slice(0, 60);
}

/** Did the two engines actually behave the same? Nothing here reads the label. */
function observedParity(spec, results) {
  if (results.sqlite.outcome !== results.postgres.outcome) return 'divergent';
  for (const entry of spec.verify ?? []) {
    const a = results.sqlite.verify.get(entry.name);
    const b = results.postgres.verify.get(entry.name);
    if (a !== undefined && b !== undefined && a !== b) return 'divergent';
  }
  return 'match';
}

const specs = await loadSpecs(path.join(HERE, 'specs'), filter);
if (specs.length === 0) {
  out(filter ? `no specs match --filter=${filter}` : 'no specs found');
  process.exit(2);
}

if (listOnly) {
  for (const spec of specs) out(`${pad(spec.invariant, 6)} ${pad(spec.id, 48)} ${spec.title}`);
  out(`\n${specs.length} specs`);
  process.exit(0);
}

const wantSqlite = engineArg !== 'postgres';
const wantPostgres = engineArg !== 'sqlite';

const sqlite = new SqliteEngine({
  schemaPath: path.join(HERE, 'schema.sql'),
  fixturePath: path.join(HERE, 'fixtures', 'base.sqlite.sql'),
});
const postgres = new PostgresEngine({ fixturePath: path.join(HERE, 'fixtures', 'base.postgres.sql') });

out('── engines');
let versions = null;
if (wantSqlite) {
  versions = sqlite.open();
  out(`   sqlite     node:sqlite ${versions.sqlite} (node ${versions.node}, experimental); system sqlite3 ${systemSqliteVersion()}`);
}
let pgReady = false;
if (wantPostgres) {
  const probe = postgres.probe();
  pgReady = probe.ok;
  out(`   postgres   ${probe.ok ? `${probe.version} · encoding ${probe.encoding}` : `UNAVAILABLE — ${probe.why}`}`);
  if (probe.ok && probe.encoding !== 'UTF8') {
    // scripts/local-db/up.sh must export LC_ALL=C (macOS aborts the postmaster
    // otherwise), and that leaves the cluster SQL_ASCII. Case folding, sorting
    // and every other collation-dependent behaviour therefore does NOT match
    // Supabase here. See specs/x1-*.
    out(`              ⚠ not UTF8: text case-folding and collation do not match Supabase, so`);
    out(`                collation-dependent parity is UNPROVEN by this run (see specs/x1-*)`);
  }
  if (!probe.ok) {
    out('');
    out('   The Postgres column cannot be filled in. Start the cluster with:');
    out('       bash scripts/local-db/up.sh');
    out('   then re-run. Running SQLite alone is fine, but say so:');
    out('       npm run test:local-sqlite -- --engine=sqlite');
    out('');
    sqlite.close();
    process.exit(1);
  }
}
out('');

const rows = [];
let failures = 0;
let errors = 0;

for (const spec of specs) {
  const results = {};
  const problems = { sqlite: [], postgres: [] };
  const skipped = {};

  for (const engine of ENGINES) {
    const selected = engine === 'sqlite' ? wantSqlite : (wantPostgres && pgReady);
    if (!selected) { skipped[engine] = { kind: 'engine', why: 'engine not selected for this run' }; continue; }
    if (typeof spec[engine].skip === 'string') {
      skipped[engine] = { kind: 'spec', why: spec[engine].skip };
      continue;
    }
    try {
      results[engine] = (engine === 'sqlite' ? sqlite : postgres).run(spec);
    } catch (error) {
      // A broken fixture is an error, not a failing invariant. Never conflate them.
      errors += 1;
      problems[engine].push(`HARNESS ERROR — ${firstLine(error.message)}`);
    }
    if (results[engine]) problems[engine] = judge(spec, engine, results[engine]);
  }

  let parityNote = '';
  let parityOk = true;
  let parityLabel = 'n/a';
  const skippedBySpec = ENGINES.some((e) => skipped[e]?.kind === 'spec');
  if (results.sqlite && results.postgres) {
    const observed = observedParity(spec, results);
    parityOk = observed === spec.parity;
    parityLabel = parityOk ? observed : `MISDECLARED (${observed})`;
    parityNote = parityOk ? `${observed} (as declared)` : `DECLARED ${spec.parity}, OBSERVED ${observed}`;
  } else if (skippedBySpec) {
    // One engine cannot express this at all; the spec has to have said so.
    parityLabel = 'not-comparable';
    parityNote = 'not-comparable (as declared)';
  } else {
    parityNote = 'one engine only — parity not established';
  }

  const specFailed = problems.sqlite.length > 0 || problems.postgres.length > 0 || !parityOk;
  if (specFailed) failures += 1;

  out(`── ${pad(spec.id, 46)} [${spec.invariant}] ${specFailed ? 'FAIL' : 'ok'}`);
  out(`   ${spec.title}`);
  for (const engine of ENGINES) {
    if (skipped[engine]) { out(`   ${pad(engine, 10)} skipped — ${skipped[engine].why}`); continue; }
    const result = results[engine];
    const summary = result
      ? `${pad(result.outcome, 9)}${result.outcome === 'refused' ? firstLine(result.message) : renderVerify(result)}`
      : 'not run';
    out(`   ${pad(engine, 10)} ${summary}`);
    for (const problem of problems[engine]) out(`   ${pad('', 10)} ✗ ${problem}`);
  }
  out(`   ${pad('parity', 10)} ${parityNote}${spec.reason ? ` — ${spec.reason}` : ''}`);
  out('');

  rows.push({
    invariant: spec.invariant,
    id: spec.id,
    postgres: describe(results.postgres, skipped.postgres),
    sqlite: describe(results.sqlite, skipped.sqlite),
    parity: parityLabel,
    ok: !specFailed,
  });
}

function renderVerify(result) {
  if (result.verify.size === 0) return '';
  return [...result.verify.entries()].map(([k, v]) => `${k}=${v}`).join('  ');
}

function describe(result, skip) {
  if (skip) return skip.kind === 'spec' ? 'skipped by spec' : 'not run';
  if (!result) return 'not run';
  if (result.outcome === 'refused') return `refused: ${refusalName(result.message)}`;
  if (result.verify.size === 0) return 'accepted';
  return `accepted (${[...result.verify.entries()].map(([k, v]) => `${k}=${v}`).join(', ')})`;
}

function clip(text, width) {
  const value = String(text);
  return value.length <= width ? pad(value, width) : `${value.slice(0, width - 1)}…`;
}

out('════════════════════════════════════════════════════════════════════════════');
out('PARITY TABLE   (postgres = the cloud today, sqlite = the proposed local file)');
out('════════════════════════════════════════════════════════════════════════════');
const w = { inv: 10, id: 44, pg: 44, lite: 44 };
out(`${pad('inv', w.inv)} ${pad('spec', w.id)} ${pad('postgres', w.pg)} ${pad('sqlite', w.lite)} parity`);
out('─'.repeat(w.inv + w.id + w.pg + w.lite + 14));
for (const row of rows) {
  out(`${clip(row.invariant, w.inv)} ${clip(row.id, w.id)} ${clip(row.postgres, w.pg)} ${clip(row.sqlite, w.lite)} ${row.parity}${row.ok ? '' : '   ← FAIL'}`);
}
out('');
const divergences = rows.filter((r) => r.parity === 'divergent').length;
out(`${rows.length} specs · ${rows.length - failures} passed · ${failures} failed · ${errors} harness errors · ${divergences} declared divergences`);
if (!wantPostgres || !pgReady) out('postgres column NOT filled in — this run proves the SQLite side only');

sqlite.close();
process.exit(failures > 0 || errors > 0 ? 1 : 0);
