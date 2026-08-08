// Rust side of the ADMISSION harness: the command layer, driven as a process.
//
// The same bridge the verb harness uses (`wealth-core-cli`, JSON on stdin, JSON
// on stdout, one process per spec) with **one argument deliberately missing**.
//
// NO `--db`, AND THAT IS THE POINT
// --------------------------------
// `lib/verb-sqlite.mjs` creates a temp database, applies `schema.sql` and the
// fixture, and hands the path over. None of that happens here, because none of
// it is needed: an admission command decides what a row MEANS and writes
// nothing.
//
// The bridge enforces it rather than trusting it. A `plan_*` command sent WITH
// `--db` exits non-zero with *"a plan_* command decides what a row means and
// writes nothing, so it is never handed a database"* — so "the planner cannot
// write" is a claim about the BINARY rather than about this file's restraint.
// `assertRefusesADatabase` below tries it on every run, before any spec, and a
// bridge that accepted the argument would fail the run rather than quietly
// removing the guarantee. It is the sibling of the FK-pragma assertion
// `lib/sqlite.mjs` makes before every constraint spec.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export class RustAdmission {
  #binary;

  constructor({ binary }) {
    this.#binary = binary;
  }

  get name() { return 'rust'; }

  /** @returns {{ ok: true, versions: object } | { ok: false, why: string }} */
  probe() {
    if (!existsSync(this.#binary)) {
      return { ok: false, why: `not built: ${this.#binary}` };
    }
    const result = spawnSync(this.#binary, ['--version'], { encoding: 'utf8' });
    if (result.status !== 0) {
      return { ok: false, why: (result.stderr || 'the bridge would not run').trim().split('\n')[0] };
    }
    try {
      return { ok: true, versions: JSON.parse(result.stdout).result ?? {} };
    } catch (error) {
      return { ok: false, why: `unreadable --version output: ${error.message}` };
    }
  }

  /**
   * @returns {{ outcome: 'ok'|'refused', code: string, message: string, result: unknown }}
   */
  run(spec) {
    const command = JSON.stringify({ verb: spec.command.verb, payload: spec.command.payload });
    // The arguments are the whole story: a binary, and nothing else.
    const result = spawnSync(this.#binary, [], { input: command, encoding: 'utf8' });

    if (result.status !== 0) {
      // A non-zero exit is a FAULT, never a refusal — the bridge prints a JSON
      // error body and exits 0 when a command is refused.
      throw new Error(`bridge fault: ${(result.stderr || '').trim().split('\n')[0] || 'no output'}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`bridge produced unreadable output: ${error.message}`);
    }

    return {
      outcome: parsed.ok ? 'ok' : 'refused',
      code: parsed.error?.code ?? '',
      message: parsed.error?.message ?? '',
      result: parsed.ok ? (parsed.result ?? null) : null,
    };
  }

  /**
   * Prove, on this binary, that a planner cannot be handed a file.
   *
   * Sends the smallest real admission command WITH `--db` and requires the
   * bridge to fault. The path names a file that does not exist, so a bridge
   * that accepted the argument would fail for the wrong reason — which is why
   * the refusal is matched by its WORDS and not merely by the exit code.
   *
   * @returns {{ ok: true } | { ok: false, why: string }}
   */
  assertRefusesADatabase() {
    const command = JSON.stringify({
      verb: 'plan_cleared_flag',
      payload: { source: 'ofx' },
    });
    const result = spawnSync(this.#binary, ['--db', '/nonexistent/wealth-admission-probe.db'], {
      input: command,
      encoding: 'utf8',
    });
    if (result.status === 0) {
      return { ok: false, why: 'the bridge ACCEPTED --db for a plan_* command' };
    }
    const stderr = (result.stderr || '').trim();
    if (!stderr.includes('never handed a database')) {
      return { ok: false, why: `it failed for another reason: ${stderr.split('\n')[0]}` };
    }
    return { ok: true };
  }
}
