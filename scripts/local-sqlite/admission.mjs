#!/usr/bin/env node
// Differential ADMISSION harness: the Rust admission surface against the
// TypeScript modules it is a port of. One payload, two implementations, and the
// ANSWER compared field by field.
//
//   node scripts/local-sqlite/admission.mjs                 everything
//   node scripts/local-sqlite/admission.mjs --filter=dedupe  only matching ids
//   node scripts/local-sqlite/admission.mjs --list           list the specs and stop
//
// Needs one thing built:
//   ~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli
//
// No Postgres cluster, and no SQLite file either. That is not a shortcut — it
// is the subject. These rules decide what a parsed row MEANS before any write
// verb sees it, so neither side of this comparison has a database and the
// bridge refuses to be handed one.
//
// A THIRD LANE, NOT AN EXTENSION OF EITHER
// ----------------------------------------
// run.mjs asks whether a SCHEMA refuses a write. verbs.mjs asks whether two
// implementations of one OPERATION agree, on the answer and on the rows left
// behind. This asks whether two implementations of one DECISION agree — and
// there are no rows to compare, because nothing is written.
//
// THE CLOCK'S ZONE IS PINNED, AND WHY IT HAS TO BE
// -------------------------------------------------
// Set before any import can construct a Date, because V8 reads TZ once. The
// dedupe fixtures carry dates in two spellings on purpose — the standard
// date-only form, which ECMA-262 parses at UTC midnight, and V8's fallback
// forms, which parse at LOCAL midnight — so the day a fallback date lands on
// depends on where the machine running this harness happens to be. Measured,
// 19 Aug 2026, on a laptop set to CEST: '2027-2-7' parsed to 06 Feb 23:00Z,
// one UTC day before its well-formed twin, and the day-gap spec went red on a
// machine while CI stayed green. That variation is REAL production behaviour
// (a browser in Sydney genuinely computes a different gap than one in London
// — TS-I7's spec now says so), but this harness compares two ENGINES, and a
// comparison must not change verdict with the operator's holiday plans. UTC
// is CI's zone, so a spec that passes here passes there.
process.env.TZ = 'UTC';

// The oracle is different too, and it is the reason this lane exists at all.
// Every verb in verbs.mjs is a port of a live Postgres function, so Postgres
// can be asked. PHASE1-PLAN §5 counts 48 invariants with no SQL side anywhere
// and names their oracle: the TypeScript's own Vitest suites. This lane does
// not transliterate those suites — it EXECUTES the modules they test.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { loadAdmissionSpecs, expectationFor, ENGINES } from './lib/admission-specs.mjs';
import { TypeScriptOracle } from './lib/admission-typescript.mjs';
import { RustAdmission } from './lib/admission-rust.mjs';

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
//
// JSON with object keys in a stable order, arrays left alone. Key order is not
// semantic in JSON, and comparing two objects by their serialisation without
// this produces failure messages whose two halves read identically. Arrays are
// NOT sorted: the order of `matches`, of `possible` and of `unmatched_feed_ids`
// is part of what is being compared, because it is the order the passes ran in.
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function show(value) {
  return value === undefined ? '(absent)' : stableJson(value);
}

/**
 * Every place two answers differ, named by its path.
 *
 * Recursive rather than a single blob comparison so the report says
 * `possible[0].held_id` instead of printing two whole result documents and
 * leaving a person to diff them by eye.
 */
function differences(left, right, prefix, into) {
  if (stableJson(left) === stableJson(right)) return into;
  const bothObjects = left !== null && right !== null
    && typeof left === 'object' && typeof right === 'object'
    && Array.isArray(left) === Array.isArray(right);
  if (bothObjects) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      const step = Array.isArray(left) ? `${prefix}[${key}]` : (prefix ? `${prefix}.${key}` : key);
      differences(left[key], right[key], step, into);
    }
    return into;
  }
  into.push(`${prefix || 'result'}: ${show(left)} vs ${show(right)}`);
  return into;
}

/** The Rust answer with the fields the TypeScript has no counterpart for removed. */
function comparable(result, spec) {
  const declared = Object.keys(spec.rustOnly ?? {});
  if (declared.length === 0 || result === null || typeof result !== 'object') return result;
  const copy = { ...result };
  for (const field of declared) delete copy[field];
  return copy;
}

/** Did this side do what the spec said it would? */
function judge(spec, engine, result) {
  const expect = expectationFor(spec, engine);
  const problems = [];

  if (result.outcome !== expect.outcome) {
    problems.push(
      `expected ${expect.outcome}, got ${result.outcome}`
      + (result.outcome === 'refused' ? `: ${result.code || firstLine(result.message)}` : ''),
    );
  } else if (expect.outcome === 'refused') {
    const named = result.code.includes(expect.error) || result.message.includes(expect.error);
    if (!named) {
      problems.push(`refusal did not name "${expect.error}": ${result.code} / ${firstLine(result.message)}`);
    }
  }

  if (result.outcome === 'ok') {
    const expected_answer = spec.divergentResult?.[engine] ?? spec.result ?? {};
    for (const [field, expected] of Object.entries(expected_answer)) {
      const got = result.result?.[field];
      if (stableJson(got) !== stableJson(expected)) {
        problems.push(`result.${field}: expected ${show(expected)}, got ${show(got)}`);
      }
    }
    if (engine === 'rust') {
      for (const [field, expected] of Object.entries(spec.rustResult ?? {})) {
        const got = result.result?.[field];
        if (stableJson(got) !== stableJson(expected)) {
          problems.push(`rustResult.${field}: expected ${show(expected)}, got ${show(got)}`);
        }
      }
    }
  }

  return problems;
}

/**
 * What the two sides ACTUALLY did, ignoring every label. Nothing here reads
 * spec.parity — a divergence that quietly stops diverging must fail.
 */
function observedParity(spec, results) {
  const notes = [];
  if (results.typescript.outcome !== results.rust.outcome) {
    notes.push(`outcome ${results.typescript.outcome} vs ${results.rust.outcome}`);
  }
  if (results.typescript.outcome === 'ok' && results.rust.outcome === 'ok') {
    differences(results.typescript.result, comparable(results.rust.result, spec), '', notes);
  }
  return { verdict: notes.length === 0 ? 'match' : 'divergent', notes };
}

const specs = await loadAdmissionSpecs(path.join(HERE, 'admission-specs'), filter);
if (specs.length === 0) {
  out(filter ? `no admission specs match --filter=${filter}` : 'no admission specs found');
  process.exit(2);
}

if (listOnly) {
  for (const spec of specs) out(`${pad(spec.invariant, 8)} ${pad(spec.id, 60)} ${spec.title}`);
  out(`\n${specs.length} admission specs`);
  process.exit(0);
}

const typescript = new TypeScriptOracle({
  repo: REPO,
  entry: path.join(HERE, 'lib', 'ts-oracle.mjs'),
});
const rust = new RustAdmission({ binary: locateBridge() });

out('── engines');
const tsProbe = typescript.probe();
if (!tsProbe.ok) {
  out(`   typescript UNAVAILABLE — ${tsProbe.why}`);
  out('');
  out('   The oracle cannot be loaded, and this lane is nothing without it.');
  out('');
  process.exit(1);
}
const rustProbe = rust.probe();
if (!rustProbe.ok) {
  out(`   rust       UNAVAILABLE — ${rustProbe.why}`);
  out('');
  out('   The Rust column cannot be filled in. Build the bridge with:');
  out('       ~/.cargo/bin/cargo build --manifest-path crates/Cargo.toml --features cli');
  out('   (or point WEALTH_CORE_CLI at an existing binary), then re-run.');
  out('');
  process.exit(1);
}

const loaded = await typescript.open();
out(`   typescript src/ through esbuild ${tsProbe.versions.esbuild} (node ${tsProbe.versions.node}),`
  + ` bundled in ${loaded.bundleMs.toFixed(0)} ms`);
out(`   rust       wealth-core ${rustProbe.versions.crate}, no database on either side`);

// The structural claim, asserted rather than described. If the bridge ever
// accepts a file for a planner, this run stops here.
const guard = rust.assertRefusesADatabase();
out(`   bridge     ${guard.ok ? 'refuses --db for a plan_* command (asserted)' : `NOT REFUSING --db — ${guard.why}`}`);
if (!guard.ok) {
  out('');
  out('   "a planner cannot write" is the whole shape of this surface. Fix the bridge.');
  out('');
  typescript.close();
  process.exit(1);
}
out('');

const rows = [];
let failures = 0;
let errors = 0;

for (const spec of specs) {
  const results = {};
  const problems = { typescript: [], rust: [] };

  // ONE DOCUMENT, NOT ONE OBJECT.
  // The Rust side receives `JSON.stringify(payload)` because it is a separate
  // process. Handing the TypeScript side the spec's live object instead would
  // let the two see different things — a `Date`, an `undefined`, a `NaN` and a
  // bigint all survive in memory and do not survive JSON. Round-tripping first
  // makes "the same payload" true rather than intended.
  const wire = {
    ...spec,
    command: { ...spec.command, payload: JSON.parse(JSON.stringify(spec.command.payload)) },
  };

  for (const engine of ENGINES) {
    try {
      results[engine] = engine === 'typescript'
        ? await typescript.run(wire)
        : rust.run(wire);
    } catch (error) {
      // A broken adapter or a broken bridge is an ERROR, not a failing
      // invariant. Never conflate them.
      errors += 1;
      problems[engine].push(`HARNESS ERROR — ${firstLine(error.message)}`);
    }
    if (results[engine]) problems[engine] = judge(spec, engine, results[engine]);
  }

  let parityOk = false;
  let parityNote = 'one side only — parity not established';
  let parityLabel = 'n/a';
  if (results.typescript && results.rust) {
    const observed = observedParity(spec, results);
    parityOk = observed.verdict === spec.parity;
    parityLabel = parityOk ? observed.verdict : `MISDECLARED (${observed.verdict})`;
    parityNote = parityOk
      ? `${observed.verdict} (as declared)`
      : `DECLARED ${spec.parity}, OBSERVED ${observed.verdict}`;
    if (observed.notes.length > 0) parityNote += ` — ${observed.notes.join('; ')}`;
  }

  const specFailed = problems.typescript.length > 0 || problems.rust.length > 0 || !parityOk;
  if (specFailed) failures += 1;

  out(`── ${pad(spec.id, 60)} [${spec.invariant}] ${specFailed ? 'FAIL' : 'ok'}`);
  out(`   ${spec.title}`);
  for (const engine of ENGINES) {
    const result = results[engine];
    out(`   ${pad(engine, 10)} ${result ? summarise(result) : 'not run'}`);
    for (const problem of problems[engine]) out(`   ${pad('', 10)} ✗ ${problem}`);
  }
  out(`   ${pad('parity', 10)} ${parityNote}`);
  if (spec.reason) out(`   ${pad('', 10)} ${spec.reason}`);
  out('');

  rows.push({
    invariant: spec.invariant,
    id: spec.id,
    typescript: describe(results.typescript),
    rust: describe(results.rust),
    parity: parityLabel,
    ok: !specFailed,
  });
}

function summarise(result) {
  if (result.outcome === 'refused') return `refused   ${result.code || firstLine(result.message)}`;
  return `ok        ${stableJson(result.result).slice(0, 150)}`;
}

function describe(result) {
  if (!result) return 'not run';
  if (result.outcome === 'refused') return `refused: ${result.code || firstLine(result.message)}`;
  return `ok: ${stableJson(result.result).slice(0, 40)}`;
}

function clip(text, width) {
  const value = String(text);
  return value.length <= width ? pad(value, width) : `${value.slice(0, width - 1)}…`;
}

out('════════════════════════════════════════════════════════════════════════════');
out('ADMISSION PARITY TABLE  (typescript = the module, rust = the port of it)');
out('════════════════════════════════════════════════════════════════════════════');
const w = { inv: 9, id: 58, ts: 34, rust: 34 };
out(`${pad('inv', w.inv)} ${pad('spec', w.id)} ${pad('typescript', w.ts)} ${pad('rust', w.rust)} parity`);
out('─'.repeat(w.inv + w.id + w.ts + w.rust + 14));
for (const row of rows) {
  out(`${clip(row.invariant, w.inv)} ${clip(row.id, w.id)} ${clip(row.typescript, w.ts)} ${clip(row.rust, w.rust)} ${row.parity}${row.ok ? '' : '   ← FAIL'}`);
}
out('');
const divergences = rows.filter((r) => r.parity === 'divergent').length;
out(
  `${rows.length} admission specs · ${rows.length - failures} passed · ${failures} failed · `
  + `${errors} harness errors · ${divergences} declared divergences`,
);

typescript.close();
process.exit(failures > 0 || errors > 0 ? 1 : 0);
