// Spec loading and shape validation.
//
// A spec is a plain object in a .spec.mjs module. It is data, not code: the
// loader rejects anything with a shape it does not recognise, so a spec cannot
// quietly grow logic that makes it pass. One file, one invariant.

import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ENGINES = ['sqlite', 'postgres'];
const OUTCOMES = ['accepted', 'refused'];
// match        — both engines must do the same thing
// divergent     — both engines run and MUST differ (a divergence that stops
//                 diverging is a failure: the spec has gone vacuous)
// not-comparable— one engine is skipped, with a stated reason
const PARITIES = ['match', 'divergent', 'not-comparable'];
const ISOLATIONS = ['transaction', 'fresh-db'];

const ENGINE_KEYS = new Set(['setup', 'action', 'expect', 'isolation', 'pragmas', 'skip']);
const SPEC_KEYS = new Set([
  'invariant', 'title', 'design', 'consequence', 'parity', 'reason', 'verify',
  ...ENGINES,
]);

function fail(file, message) {
  throw new Error(`${path.basename(file)}: ${message}`);
}

function validateEngine(file, engine, block) {
  if (typeof block !== 'object' || block === null) fail(file, `${engine} must be an object`);
  for (const key of Object.keys(block)) {
    if (!ENGINE_KEYS.has(key)) fail(file, `${engine}.${key} is not a recognised key`);
  }
  if (typeof block.skip === 'string') {
    // A skipped engine states why in prose. It is reported, never counted as a pass.
    if (block.action !== undefined) fail(file, `${engine} is skipped but still carries an action`);
    return;
  }
  if (typeof block.action !== 'string' || block.action.trim() === '') {
    fail(file, `${engine}.action must be a non-empty SQL string`);
  }
  if (block.setup !== undefined && typeof block.setup !== 'string') {
    fail(file, `${engine}.setup must be a SQL string`);
  }
  const expect = block.expect;
  if (typeof expect !== 'object' || expect === null) fail(file, `${engine}.expect is required`);
  if (!OUTCOMES.includes(expect.outcome)) {
    fail(file, `${engine}.expect.outcome must be one of ${OUTCOMES.join(', ')}`);
  }
  if (expect.outcome === 'refused' && (typeof expect.message !== 'string' || expect.message === '')) {
    // A refusal must be NAMED. "it errored" is not a proof that the right rule
    // fired — a typo in the fixture also errors.
    fail(file, `${engine}.expect.message must name the refusal (a substring of the engine's error)`);
  }
  if (expect.outcome === 'accepted' && expect.message !== undefined) {
    fail(file, `${engine}.expect.message makes no sense on an accepted action`);
  }
  if (block.isolation !== undefined) {
    if (engine !== 'sqlite') fail(file, 'isolation is a SQLite-only knob');
    if (!ISOLATIONS.includes(block.isolation)) {
      fail(file, `sqlite.isolation must be one of ${ISOLATIONS.join(', ')}`);
    }
  }
  if (block.pragmas !== undefined) {
    if (engine !== 'sqlite') fail(file, 'pragmas is a SQLite-only knob');
    if (block.isolation !== 'fresh-db') {
      fail(file, 'sqlite.pragmas requires isolation: "fresh-db" — a shared connection must not be re-pragma\'d');
    }
    if (!Array.isArray(block.pragmas) || block.pragmas.some((p) => typeof p !== 'string')) {
      fail(file, 'sqlite.pragmas must be an array of strings');
    }
  }
}

function validateVerify(file, verify) {
  if (verify === undefined) return;
  if (!Array.isArray(verify)) fail(file, 'verify must be an array');
  for (const entry of verify) {
    if (typeof entry?.name !== 'string' || entry.name === '') fail(file, 'each verify needs a name');
    // `only` marks an assertion about ONE engine's environment rather than a
    // shared assertion — a tripwire, not a comparison. It never contributes to
    // parity, so it cannot be used to talk a divergence into looking like a match.
    if (entry.only !== undefined && !ENGINES.includes(entry.only)) {
      fail(file, `verify "${entry.name}".only must be one of ${ENGINES.join(', ')}`);
    }
    const engines = entry.only ? [entry.only] : ENGINES;
    for (const engine of engines) {
      if (typeof entry[engine] !== 'string' || entry[engine].trim() === '') {
        fail(file, `verify "${entry.name}" needs a ${engine} SELECT`);
      }
    }
    const expected = entry.expect;
    const perEngine = typeof expected === 'object' && expected !== null;
    if (perEngine) {
      if (entry.only) fail(file, `verify "${entry.name}" is single-engine, so expect must be one string`);
      for (const engine of ENGINES) {
        if (typeof expected[engine] !== 'string') {
          fail(file, `verify "${entry.name}".expect.${engine} must be a string`);
        }
      }
    } else if (typeof expected !== 'string') {
      fail(file, `verify "${entry.name}".expect must be a string, or {sqlite, postgres} when the engines differ`);
    }
  }
}

function validate(file, spec) {
  if (typeof spec !== 'object' || spec === null) fail(file, 'default export must be an object');
  for (const key of Object.keys(spec)) {
    if (!SPEC_KEYS.has(key)) fail(file, `"${key}" is not a recognised spec key`);
  }
  for (const key of ['invariant', 'title', 'design', 'consequence']) {
    if (typeof spec[key] !== 'string' || spec[key].trim() === '') {
      fail(file, `${key} is required — a spec that cannot say which rule it protects is not a spec`);
    }
  }
  if (!PARITIES.includes(spec.parity)) fail(file, `parity must be one of ${PARITIES.join(', ')}`);
  if (spec.parity !== 'match' && (typeof spec.reason !== 'string' || spec.reason.trim() === '')) {
    fail(file, `parity "${spec.parity}" must state its reason`);
  }
  if (spec.parity === 'match' && spec.reason !== undefined) {
    fail(file, 'reason belongs to a divergence; a match needs no excuse');
  }
  for (const engine of ENGINES) validateEngine(file, engine, spec[engine]);
  const skips = ENGINES.filter((engine) => typeof spec[engine].skip === 'string');
  if (spec.parity === 'not-comparable' && skips.length !== 1) {
    fail(file, 'parity "not-comparable" means exactly one engine is skipped');
  }
  if (spec.parity !== 'not-comparable' && skips.length > 0) {
    fail(file, `${skips[0]} is skipped, so parity cannot be "${spec.parity}" — say "not-comparable" and why`);
  }
  validateVerify(file, spec.verify);
}

/**
 * Load every specs/*.spec.mjs, in filename order.
 * @param {string} dir absolute path to the specs directory
 * @param {string} [filter] substring; when given, only matching ids load
 */
export async function loadSpecs(dir, filter) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.spec.mjs')).sort();
  const specs = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const id = file.replace(/\.spec\.mjs$/, '');
    if (filter && !id.includes(filter) && !file.includes(filter)) continue;
    const mod = await import(pathToFileURL(full).href);
    const spec = mod.default;
    validate(full, spec);
    specs.push({ id, file: full, ...spec });
  }
  return specs;
}

export { ENGINES };
