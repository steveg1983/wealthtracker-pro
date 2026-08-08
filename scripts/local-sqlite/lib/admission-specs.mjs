// Admission-spec loading and shape validation.
//
// A third spec shape, and the reason there are three rather than one:
//
//   * a CONSTRAINT spec (lib/specs.mjs) carries SQL PER ENGINE, because the two
//     schemas are different shapes;
//   * a VERB spec (lib/verb-specs.mjs) carries ONE payload sent to two
//     implementations of one operation, and asserts the rows left behind;
//   * an ADMISSION spec carries one payload sent to a TypeScript module and to
//     the Rust that ports it, and asserts the ANSWER — because nothing is left
//     behind. There are no rows. Neither side writes.
//
// THE RULE THIS LOADER ENFORCES THAT THE OTHERS DO NOT
// ---------------------------------------------------
// `parity: 'not-comparable'` does not exist here, and a spec that asks for it
// is refused with the reason. In the verb harness it is legitimate: the cloud
// genuinely has no `verify_integrity`, so a spec for it can only run one
// engine. Here the TypeScript module IS the thing being ported — it is present
// by definition, and a spec that could not run it would be a spec for a rule
// that is not a port of anything. Every admission spec is two-sided.
//
// Everything else keeps the house rules: one file, one invariant; a refusal
// must be NAMED; a declared divergence that stops diverging is a FAILURE.

import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ENGINES = ['typescript', 'rust'];
const OUTCOMES = ['ok', 'refused'];
// match     — both sides run and must agree
// divergent — both sides run and MUST differ (a divergence that stops
//             diverging is a failure: the spec has gone vacuous)
const PARITIES = ['match', 'divergent'];

const SPEC_KEYS = new Set([
  'invariant', 'title', 'design', 'consequence', 'parity', 'reason',
  'command', 'expect', 'result', 'divergentResult', 'rustOnly', 'rustResult',
]);

function fail(file, message) {
  throw new Error(`${path.basename(file)}: ${message}`);
}

function validateExpect(file, label, expect) {
  if (typeof expect !== 'object' || expect === null) fail(file, `${label} is required`);
  if (!OUTCOMES.includes(expect.outcome)) {
    fail(file, `${label}.outcome must be one of ${OUTCOMES.join(', ')}`);
  }
  if (expect.outcome === 'refused') {
    // The same rule both older harnesses enforce: naming the refusal is what
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
  if (spec.parity === 'not-comparable') {
    fail(file, 'there is no "not-comparable" here: the TypeScript module IS what is being ported, '
      + 'so a spec that cannot run it is a spec for a rule with no oracle');
  }
  if (!PARITIES.includes(spec.parity)) fail(file, `parity must be one of ${PARITIES.join(', ')}`);
  if (spec.parity !== 'match' && (typeof spec.reason !== 'string' || spec.reason.trim() === '')) {
    fail(file, `parity "${spec.parity}" must state its reason`);
  }
  if (spec.parity === 'match' && spec.reason !== undefined) {
    fail(file, 'reason belongs to a divergence; a match needs no excuse');
  }

  const command = spec.command;
  if (typeof command !== 'object' || command === null) fail(file, 'command is required');
  if (typeof command.verb !== 'string' || command.verb === '') fail(file, 'command.verb is required');
  if (typeof command.payload !== 'object' || command.payload === null) {
    fail(file, 'command.payload must be the object BOTH sides receive');
  }

  // The shared expectation, plus per-engine ones for a declared divergence.
  if (spec.expect?.typescript || spec.expect?.rust) {
    for (const engine of ENGINES) validateExpect(file, `expect.${engine}`, spec.expect[engine]);
  } else {
    validateExpect(file, 'expect', spec.expect);
  }

  const rustOnly = spec.rustOnly ?? {};
  if (typeof rustOnly !== 'object' || rustOnly === null) {
    fail(file, 'rustOnly must be an object of { field: reason }');
  }
  for (const [field, reason] of Object.entries(rustOnly)) {
    if (typeof reason !== 'string' || reason.trim() === '') {
      fail(file, `rustOnly.${field} must state WHY the TypeScript has no counterpart for it`);
    }
  }

  if (spec.result !== undefined) {
    if (typeof spec.result !== 'object' || spec.result === null) fail(file, 'result must be an object');
    for (const field of Object.keys(spec.result)) {
      if (field in rustOnly) {
        fail(file, `result.${field} is declared rustOnly — assert it in rustResult instead, `
          + 'or stop declaring it');
      }
    }
  }
  // TWO SIDES THAT BOTH ANSWER, AND ANSWER DIFFERENTLY.
  // `expect` covers a divergence where one side refuses. This covers the other
  // shape: both accept and the ANSWERS differ, which is what a date the browser
  // reads and the port does not looks like. It exists only for `divergent`, so
  // a spec cannot use it to describe two answers it has called a match.
  if (spec.divergentResult !== undefined) {
    if (spec.parity !== 'divergent') {
      fail(file, 'divergentResult belongs to a divergence; a match has one answer');
    }
    if (spec.result !== undefined) {
      fail(file, 'a spec has either one expected answer (result) or two (divergentResult)');
    }
    for (const engine of ENGINES) {
      if (typeof spec.divergentResult[engine] !== 'object' || spec.divergentResult[engine] === null) {
        fail(file, `divergentResult.${engine} must say what THAT side answers`);
      }
    }
    for (const key of Object.keys(spec.divergentResult)) {
      if (!ENGINES.includes(key)) fail(file, `divergentResult.${key} is not a side`);
    }
  }

  if (spec.rustResult !== undefined) {
    if (typeof spec.rustResult !== 'object' || spec.rustResult === null) {
      fail(file, 'rustResult must be an object');
    }
    for (const field of Object.keys(spec.rustResult)) {
      // Anything both sides answer belongs in `result`, where it is compared.
      // rustResult is for the fields the comparison has been told to skip.
      if (!(field in rustOnly)) {
        fail(file, `rustResult.${field} is not declared rustOnly — put it in result, where both `
          + 'sides are held to it');
      }
    }
  }
}

/** The expectation this side is held to. */
export function expectationFor(spec, engine) {
  if (spec.expect?.typescript || spec.expect?.rust) return spec.expect[engine];
  return spec.expect;
}

/**
 * Load every admission-specs/*.spec.mjs, in filename order.
 * @param {string} dir absolute path to the admission-specs directory
 * @param {string} [filter] substring; when given, only matching ids load
 */
export async function loadAdmissionSpecs(dir, filter) {
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
