#!/usr/bin/env node
// Differential VERB harness: the Rust command layer against the live Postgres
// RPC it is a port of. One command, two engines, and BOTH the answer and the
// resulting database state compared.
//
//   node scripts/local-sqlite/verbs.mjs                 both engines
//   node scripts/local-sqlite/verbs.mjs --filter=b2     only matching ids
//   node scripts/local-sqlite/verbs.mjs --list          list the specs and stop
//
// Needs two things running:
//   bash scripts/local-db/up.sh
//   ~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli
//
// SIBLING, NOT AN EXTENSION, OF run.mjs
// -------------------------------------
// The 54 constraint specs prove that a schema refuses a write. A verb spec
// proves that two implementations of one operation agree — on what they return,
// on what they refuse, AND on the rows they leave behind. Those are different
// questions with different spec shapes (a constraint spec carries SQL per
// engine; a verb spec carries ONE payload), and folding them into one runner
// would mean a spec file that can be either, which is a spec file that has to be
// read twice before you know what it is.
//
// `npm run test:local-sqlite` is unchanged and still 54/54.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { loadVerbSpecs, expectationFor, forEngine, ENGINES } from './lib/verb-specs.mjs';
import { SqliteVerbEngine } from './lib/verb-sqlite.mjs';
import { PostgresVerbEngine } from './lib/verb-postgres.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const filter = arg('filter', undefined);
const listOnly = argv.includes('--list');

const pad = (text, width) => String(text).padEnd(width);
const out = (line = '') => process.stdout.write(`${line}\n`);

function firstLine(text) {
  return String(text).split('\n').find((l) => l.trim() !== '')?.trim().slice(0, 160) ?? '';
}

function locateBridge() {
  if (process.env.WEALTH_CORE_CLI) return process.env.WEALTH_CORE_CLI;
  for (const profile of ['release', 'debug']) {
    const candidate = path.join(REPO, 'crates', 'target', profile, 'wealth-core-cli');
    if (existsSync(candidate)) return candidate;
  }
  return path.join(REPO, 'crates', 'target', 'debug', 'wealth-core-cli');
}

// ── Canonical comparison ────────────────────────────────────────────────────
// Two engines, two type systems, one question: is this the same row?
//
// Money already arrives as a decimal string from both sides. What is left is
// ordering: `tags` is a `text[]` in the cloud and a child table locally, and a
// child table is a SET. Sorting both is the only comparison that is not an
// accident, and it is a real (small) divergence, recorded in the parity notes.
function canonicalise(row) {
  if (!row) return null;
  const canonical = {};
  for (const key of Object.keys(row).sort()) {
    const value = row[key];
    canonical[key] = Array.isArray(value) ? [...value].sort() : value;
  }
  return canonical;
}

/**
 * JSON with object keys in a stable order, arrays left alone.
 *
 * `judge` compares an expected value against a returned one by string equality,
 * which for a nested object makes KEY ORDER load-bearing — and key order is not
 * semantic in JSON. Without this, a spec asserting a `verify_integrity` finding
 * fails with a diff whose two sides read identically, which is the worst kind of
 * failure message. Arrays are NOT sorted: the order of `findings` is part of
 * that verb's contract and a spec that gets it wrong must say so.
 */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function show(value) {
  return value === undefined ? '(absent)' : JSON.stringify(value);
}

/** Did this engine do what the spec said it would? */
function judge(spec, engine, result) {
  const expect = expectationFor(spec, engine);
  const problems = [];

  if (result.outcome !== expect.outcome) {
    problems.push(
      `expected ${expect.outcome}, got ${result.outcome}` +
      (result.outcome === 'refused' ? `: ${result.code || firstLine(result.message)}` : ''),
    );
  } else if (expect.outcome === 'refused') {
    const named = result.code.includes(expect.error) || result.message.includes(expect.error);
    if (!named) {
      problems.push(`refusal did not name "${expect.error}": ${result.code} / ${firstLine(result.message)}`);
    }
  }

  if (result.outcome === 'ok') {
    for (const [field, expected] of Object.entries(spec.result ?? {})) {
      const wanted = forEngine(expected, engine);
      const got = result.row?.[field];
      if (stableJson(got) !== stableJson(wanted)) {
        problems.push(`result.${field}: expected ${show(wanted)}, got ${show(got)}`);
      }
    }
  }

  for (const entry of spec.state ?? []) {
    if (!result.state.has(entry.name)) continue;
    const wanted = forEngine(entry.expect, engine);
    const got = result.state.get(entry.name);
    if (got !== wanted) problems.push(`${entry.name}: expected ${wanted}, got ${got}`);
  }

  return problems;
}

/**
 * What the two engines ACTUALLY did, ignoring every label. Nothing in here
 * reads spec.parity — a divergence that quietly stops diverging must fail.
 */
function observedParity(spec, results) {
  const notes = [];
  if (results.sqlite.outcome !== results.postgres.outcome) {
    notes.push(`outcome ${results.sqlite.outcome} vs ${results.postgres.outcome}`);
  }
  if (results.sqlite.outcome === 'refused' && results.postgres.outcome === 'refused') {
    // Both refused. The MESSAGES are allowed to differ — the engines word their
    // own rules — so parity here is about the outcome and the state, not prose.
    notes.push(...[]);
  }

  const left = canonicalise(results.sqlite.row);
  const right = canonicalise(results.postgres.row);
  if (left && right) {
    const declared = new Set(Object.keys(spec.rowDivergence ?? {}));
    // A generated id cannot match across engines and says nothing when it does
    // not; a spec that cares supplies one in the payload.
    if (!spec.command.payload.id) declared.add('id');
    const fields = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const field of fields) {
      if (declared.has(field)) continue;
      if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) {
        notes.push(`row.${field}: ${show(left[field])} vs ${show(right[field])}`);
      }
    }
  }

  for (const entry of spec.state ?? []) {
    const a = results.sqlite.state.get(entry.name);
    const b = results.postgres.state.get(entry.name);
    if (a !== undefined && b !== undefined && a !== b) {
      notes.push(`${entry.name}: ${a} vs ${b}`);
    }
  }

  return { verdict: notes.length === 0 ? 'match' : 'divergent', notes };
}

const specs = await loadVerbSpecs(path.join(HERE, 'verb-specs'), filter);
if (specs.length === 0) {
  out(filter ? `no verb specs match --filter=${filter}` : 'no verb specs found');
  process.exit(2);
}

if (listOnly) {
  for (const spec of specs) out(`${pad(spec.invariant, 8)} ${pad(spec.id, 56)} ${spec.title}`);
  out(`\n${specs.length} verb specs`);
  process.exit(0);
}

const bridge = locateBridge();
const sqlite = new SqliteVerbEngine({
  schemaPath: path.join(HERE, 'schema.sql'),
  fixturePath: path.join(HERE, 'fixtures', 'base.sqlite.sql'),
  binary: bridge,
});
const postgres = new PostgresVerbEngine({
  fixturePath: path.join(HERE, 'fixtures', 'base.postgres.sql'),
});

out('── engines');
const bridgeProbe = sqlite.probe();
if (!bridgeProbe.ok) {
  out(`   sqlite     UNAVAILABLE — ${bridgeProbe.why}`);
  out('');
  out('   The Rust column cannot be filled in. Build the verb bridge with:');
  out('       ~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli');
  out('   (or point WEALTH_CORE_CLI at an existing binary), then re-run.');
  out('');
  process.exit(1);
}
const versions = sqlite.open();
out(`   sqlite     wealth-core ${bridgeProbe.versions.crate} via rusqlite ${bridgeProbe.versions.rusqlite}`);
out(`              fixtures through node:sqlite ${versions.sqlite} (node ${versions.node}, experimental)`);

const pgProbe = postgres.probe();
out(`   postgres   ${pgProbe.ok ? `${pgProbe.version} · encoding ${pgProbe.encoding}` : `UNAVAILABLE — ${pgProbe.why}`}`);
if (pgProbe.ok && pgProbe.encoding !== 'UTF8') {
  out('              ⚠ not UTF8: collation-dependent parity is UNPROVEN by this run');
}
if (!pgProbe.ok) {
  out('');
  out('   The Postgres column cannot be filled in. Start the cluster with:');
  out('       bash scripts/local-db/up.sh');
  out('   A verb harness with one engine proves nothing it set out to prove, so this is fatal.');
  out('');
  sqlite.close();
  process.exit(1);
}
out('');

const rows = [];
let failures = 0;
let errors = 0;

for (const spec of specs) {
  const results = {};
  const problems = { sqlite: [], postgres: [] };

  for (const engine of ENGINES) {
    // A DECLARED skip is not a failure and not a pass: the engine has nothing to
    // run, said so in prose, and the spec's parity says "not-comparable". The
    // loader has already refused any other combination.
    if (spec.skip?.[engine] !== undefined) continue;
    try {
      results[engine] = (engine === 'sqlite' ? sqlite : postgres).run(spec);
    } catch (error) {
      // A broken fixture or a broken bridge is an ERROR, not a failing
      // invariant. Never conflate them.
      errors += 1;
      problems[engine].push(`HARNESS ERROR — ${firstLine(error.message)}`);
    }
    if (results[engine]) problems[engine] = judge(spec, engine, results[engine]);
  }

  let parityOk = false;
  let parityNote = 'one engine only — parity not established';
  let parityLabel = 'n/a';
  if (spec.parity === 'not-comparable') {
    // The one case where running a single engine is the whole point. It is
    // still reported as what it is: an assertion about one engine, contributing
    // nothing to the parity table.
    parityOk = true;
    parityLabel = 'not-comparable';
    parityNote = `not-comparable (as declared) — ${spec.reason}`;
  } else if (results.sqlite && results.postgres) {
    const observed = observedParity(spec, results);
    parityOk = observed.verdict === spec.parity;
    parityLabel = parityOk ? observed.verdict : `MISDECLARED (${observed.verdict})`;
    parityNote = parityOk
      ? `${observed.verdict} (as declared)`
      : `DECLARED ${spec.parity}, OBSERVED ${observed.verdict}`;
    if (observed.notes.length > 0) parityNote += ` — ${observed.notes.join('; ')}`;
  }

  const specFailed = problems.sqlite.length > 0 || problems.postgres.length > 0 || !parityOk;
  if (specFailed) failures += 1;

  out(`── ${pad(spec.id, 56)} [${spec.invariant}] ${specFailed ? 'FAIL' : 'ok'}`);
  out(`   ${spec.title}`);
  for (const engine of ENGINES) {
    const result = results[engine];
    const skipped = spec.skip?.[engine];
    out(`   ${pad(engine, 10)} ${skipped ? `skipped   ${skipped}` : (result ? summarise(result) : 'not run')}`);
    for (const problem of problems[engine]) out(`   ${pad('', 10)} ✗ ${problem}`);
  }
  out(`   ${pad('parity', 10)} ${parityNote}`);
  if (spec.reason) out(`   ${pad('', 10)} ${spec.reason}`);
  out('');

  rows.push({
    invariant: spec.invariant,
    id: spec.id,
    postgres: spec.skip?.postgres ? 'skipped: no counterpart' : describe(results.postgres),
    sqlite: spec.skip?.sqlite ? 'skipped: no counterpart' : describe(results.sqlite),
    parity: parityLabel,
    ok: !specFailed,
  });
}

function summarise(result) {
  if (result.outcome === 'refused') return `refused   ${result.code || firstLine(result.message)}`;
  const state = [...result.state.entries()].map(([k, v]) => `${k}=${v}`).join('  ');
  return `ok        ${result.row?.amount ?? ''} ${state}`.trimEnd();
}

function describe(result) {
  if (!result) return 'not run';
  if (result.outcome === 'refused') return `refused: ${result.code || firstLine(result.message)}`;
  return `ok (amount=${result.row?.amount ?? '?'})`;
}

function clip(text, width) {
  const value = String(text);
  return value.length <= width ? pad(value, width) : `${value.slice(0, width - 1)}…`;
}

out('════════════════════════════════════════════════════════════════════════════');
out('VERB PARITY TABLE  (postgres = the live RPC, sqlite = the Rust command layer)');
out('════════════════════════════════════════════════════════════════════════════');
const w = { inv: 9, id: 52, pg: 40, lite: 40 };
out(`${pad('inv', w.inv)} ${pad('spec', w.id)} ${pad('postgres', w.pg)} ${pad('sqlite', w.lite)} parity`);
out('─'.repeat(w.inv + w.id + w.pg + w.lite + 14));
for (const row of rows) {
  out(`${clip(row.invariant, w.inv)} ${clip(row.id, w.id)} ${clip(row.postgres, w.pg)} ${clip(row.sqlite, w.lite)} ${row.parity}${row.ok ? '' : '   ← FAIL'}`);
}
out('');
const divergences = rows.filter((r) => r.parity === 'divergent').length;
const singleEngine = rows.filter((r) => r.parity === 'not-comparable').length;
out(
  `${rows.length} verb specs · ${rows.length - failures} passed · ${failures} failed · ` +
  `${errors} harness errors · ${divergences} declared divergences · ` +
  `${singleEngine} single-engine (a verb the cloud does not have)`,
);

sqlite.close();
process.exit(failures > 0 || errors > 0 ? 1 : 0);
