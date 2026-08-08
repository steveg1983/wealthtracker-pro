// Verb-spec loading and shape validation.
//
// A VERB spec differs from a CONSTRAINT spec (lib/specs.mjs) in exactly one
// way, and it is the important one: the operation is **not** written twice.
// A constraint spec carries a SQL statement per engine because the two schemas
// are different shapes. A verb spec carries ONE command — the same JSON payload
// the cloud RPC takes as `jsonb` and the Rust CLI takes on stdin — because if
// the two engines needed different commands they would not be implementations
// of the same verb and there would be nothing to compare.
//
// Everything else keeps the house rules: one file, one invariant; a refusal must
// be NAMED; a declared divergence that stops diverging is a FAILURE, not a bonus.

import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ENGINES = ['sqlite', 'postgres'];
const OUTCOMES = ['ok', 'refused'];
const PARITIES = ['match', 'divergent'];

const SPEC_KEYS = new Set([
  'invariant', 'title', 'design', 'consequence', 'parity', 'reason',
  'setup', 'command', 'expect', 'result', 'rowDivergence', 'state',
]);

function fail(file, message) {
  throw new Error(`${path.basename(file)}: ${message}`);
}

/** An expectation is one value for both engines, or one per engine. */
function validatePerEngine(file, label, value, kind = 'string') {
  if (typeof value === kind) return;
  if (typeof value === 'object' && value !== null) {
    for (const engine of ENGINES) {
      if (typeof value[engine] !== kind) {
        fail(file, `${label}.${engine} must be a ${kind}`);
      }
    }
    return;
  }
  fail(file, `${label} must be a ${kind}, or {sqlite, postgres} when the engines differ`);
}

function validateExpect(file, label, expect) {
  if (typeof expect !== 'object' || expect === null) fail(file, `${label} is required`);
  if (!OUTCOMES.includes(expect.outcome)) {
    fail(file, `${label}.outcome must be one of ${OUTCOMES.join(', ')}`);
  }
  if (expect.outcome === 'refused') {
    // The same rule the constraint harness enforces: naming the refusal is what
    // separates "the right rule fired" from "something went wrong".
    if (typeof expect.error !== 'string' || expect.error === '') {
      fail(file, `${label}.error must name the refusal (a code, or a substring of the message)`);
    }
  } else if (expect.error !== undefined) {
    fail(file, `${label}.error makes no sense on an accepted command`);
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
  if (spec.parity === 'divergent' && (typeof spec.reason !== 'string' || spec.reason.trim() === '')) {
    fail(file, 'parity "divergent" must state its reason');
  }
  if (spec.parity === 'match' && spec.reason !== undefined) {
    fail(file, 'reason belongs to a divergence; a match needs no excuse');
  }

  const command = spec.command;
  if (typeof command !== 'object' || command === null) fail(file, 'command is required');
  if (typeof command.verb !== 'string' || command.verb === '') fail(file, 'command.verb is required');
  if (typeof command.payload !== 'object' || command.payload === null) {
    fail(file, 'command.payload must be the object BOTH engines receive');
  }

  if (spec.setup !== undefined) {
    if (typeof spec.setup !== 'object' || spec.setup === null) fail(file, 'setup must be an object');
    for (const engine of ENGINES) {
      if (spec.setup[engine] !== undefined && typeof spec.setup[engine] !== 'string') {
        fail(file, `setup.${engine} must be a SQL string`);
      }
    }
  }

  // The shared expectation, plus per-engine overrides for a declared divergence.
  const shared = spec.expect?.shared ?? spec.expect;
  if (spec.expect?.sqlite || spec.expect?.postgres) {
    for (const engine of ENGINES) {
      validateExpect(file, `expect.${engine}`, spec.expect[engine]);
    }
  } else {
    validateExpect(file, 'expect', shared);
  }

  if (spec.result !== undefined) {
    if (typeof spec.result !== 'object' || spec.result === null) fail(file, 'result must be an object');
  }
  if (spec.rowDivergence !== undefined) {
    if (typeof spec.rowDivergence !== 'object' || spec.rowDivergence === null) {
      fail(file, 'rowDivergence must be an object of { field: reason }');
    }
    for (const [field, reason] of Object.entries(spec.rowDivergence)) {
      if (typeof reason !== 'string' || reason.trim() === '') {
        fail(file, `rowDivergence.${field} must state WHY the two engines may differ here`);
      }
    }
  }

  if (spec.state !== undefined) {
    if (!Array.isArray(spec.state)) fail(file, 'state must be an array');
    // Results are collected into a Map keyed by name, so two entries sharing one
    // silently discard the first and the spec asserts less than it says it does.
    // FOUND THE HARD WAY: `storedFlag` names itself after the COLUMN, so
    // asserting the same flag on two different rows was one assertion, and the
    // one that survived was the one that happened to be second.
    const seen = new Set();
    for (const entry of spec.state) {
      if (typeof entry?.name !== 'string' || entry.name === '') fail(file, 'each state needs a name');
      if (seen.has(entry.name)) {
        fail(file, `two state entries are both called "${entry.name}" — the second would silently replace the first`);
      }
      seen.add(entry.name);
      for (const engine of ENGINES) {
        if (typeof entry[engine] !== 'string' || entry[engine].trim() === '') {
          fail(file, `state "${entry.name}" needs a ${engine} SELECT`);
        }
      }
      validatePerEngine(file, `state "${entry.name}".expect`, entry.expect);
    }
  }
}

/** Resolve an expectation for one engine. */
export function forEngine(value, engine) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return engine in value ? value[engine] : value;
  }
  return value;
}

/** The expectation this engine is held to. */
export function expectationFor(spec, engine) {
  if (spec.expect?.sqlite || spec.expect?.postgres) return spec.expect[engine];
  return spec.expect;
}

/**
 * Load every verb-specs/*.spec.mjs, in filename order.
 * @param {string} dir absolute path to the verb-specs directory
 * @param {string} [filter] substring; when given, only matching ids load
 */
export async function loadVerbSpecs(dir, filter) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.spec.mjs')).sort();
  const specs = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const id = file.replace(/\.spec\.mjs$/, '');
    if (filter && !id.includes(filter)) continue;
    const mod = await import(pathToFileURL(full).href);
    const spec = mod.default;
    validate(full, spec);
    specs.push({ id, file: full, ...spec });
  }
  return specs;
}

export { ENGINES };
