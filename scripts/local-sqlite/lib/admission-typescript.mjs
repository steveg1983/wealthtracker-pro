// TypeScript side of the ADMISSION harness: the oracle, executed.
//
// WHY THIS EXISTS RATHER THAN A TABLE OF EXPECTED VALUES
// -----------------------------------------------------
// PHASE1-PLAN §5.2 sets out the method for the 48 invariants that have no
// Postgres side: *"Extract each Vitest case's fixture and expectation into the
// same scenario format… run the Rust implementation against those cases."*
// That is transliteration, and its weakness is that a transliterated
// expectation is a COPY of the oracle taken on one day. The module can change
// and the copy will not notice; it will keep passing, describing behaviour that
// no longer exists.
//
// So this driver runs the module instead. One payload, two implementations, and
// if `src/utils/statementDuplicates.ts` changes tomorrow, the lane says so
// tomorrow.
//
// HOW THE TYPESCRIPT IS LOADED
// ----------------------------
// esbuild bundles `ts-oracle.mjs` — which imports `src/` directly — into one
// ESM file in a temp directory, ONCE per run, and Node imports it natively.
//
// * **esbuild rather than tsx.** Both are present in `node_modules` and both
//   arrive through `vite`, which is a direct devDependency; neither is a new
//   dependency and this harness must not add one (`lib/sqlite.mjs` states the
//   rule: no native devDependency for a test harness). esbuild wins on the
//   thing that matters here — it produces a plain file that `import()` loads
//   with no loader hook in the process, so there is no interaction between the
//   oracle's module graph and the runner's.
// * **No type checking, deliberately.** `tsc -b` covers `src`, `vite.config.ts`
//   and `api`; nothing under `scripts/`. Bundling with esbuild ERASES types
//   rather than checking them, which is exactly right: the oracle's job is to
//   run the shipped module, and the shipped module is typechecked by the repo's
//   own gate. A second, weaker check here would only be able to disagree.
//
// IN-PROCESS, AND THE ASYMMETRY STATED RATHER THAN HIDDEN
// ------------------------------------------------------
// The Rust side spawns a process per spec; this side calls a function. The verb
// harness went out of its way to give neither engine a structural advantage
// (both spawn), and that argument does not apply here for a reason worth
// writing down: there is no database, no connection and no transaction on
// either side, so there is no state a spec could leave behind for the next one.
// Every function in the oracle is pure.
//
// The one exception is real and is the reason the arrangement is sound rather
// than merely convenient: `src/utils/decimal.ts` calls `Decimal.config()` at
// import time, setting precision 20 and ROUND_HALF_UP globally. That is module
// state, it is shared by every spec, and it is exactly the state the money
// comparison depends on — so sharing it is the point.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

export class TypeScriptOracle {
  #repo;
  #entry;
  #dir = null;
  #module = null;
  #esbuild = null;

  constructor({ repo, entry }) {
    this.#repo = repo;
    this.#entry = entry;
  }

  get name() { return 'typescript'; }

  /** @returns {{ ok: true, versions: object } | { ok: false, why: string }} */
  probe() {
    if (!existsSync(this.#entry)) {
      return { ok: false, why: `the oracle is missing: ${this.#entry}` };
    }
    try {
      const require = createRequire(path.join(this.#repo, 'package.json'));
      this.#esbuild = require('esbuild');
    } catch (error) {
      return { ok: false, why: `esbuild is not installed (${error.message}); run npm ci` };
    }
    return { ok: true, versions: { esbuild: this.#esbuild.version, node: process.version } };
  }

  /** Bundle the oracle once and load it. */
  async open() {
    this.#dir = mkdtempSync(path.join(tmpdir(), 'wt-ts-oracle-'));
    const outfile = path.join(this.#dir, 'oracle.mjs');
    const started = performance.now();
    await this.#esbuild.build({
      entryPoints: [this.#entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      outfile,
      logLevel: 'silent',
    });
    const bundleMs = performance.now() - started;
    this.#module = await import(pathToFileURL(outfile).href);
    return { bundleMs, verbs: this.#module.ORACLE_VERBS };
  }

  close() {
    if (this.#dir) { rmSync(this.#dir, { recursive: true, force: true }); this.#dir = null; }
  }

  /**
   * @returns {{ outcome: 'ok'|'refused', code: string, message: string, result: unknown }}
   */
  async run(spec) {
    // A THROW is a harness fault, never a refusal: the oracle's functions do
    // not refuse, they answer. The one thing that can throw on purpose is the
    // adapter's money renderer, and that is a fault too — it means the spec
    // needs to declare something it has not declared.
    const answer = await this.#module.answer(spec.command.verb, spec.command.payload);
    if (answer.ok) {
      return { outcome: 'ok', code: '', message: '', result: answer.result };
    }
    return {
      outcome: 'refused',
      code: answer.error?.code ?? '',
      message: answer.error?.message ?? '',
      result: null,
    };
  }
}
