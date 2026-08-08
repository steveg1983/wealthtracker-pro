// SQLite side of the VERB harness: the Rust command layer, driven as a process.
//
// THE BRIDGE, AND WHY IT IS A SPAWNED BINARY
// ------------------------------------------
// crates/wealth-core exposes `wealth-core-cli` (behind `--features cli`): JSON
// command on stdin, JSON result on stdout. This module spawns it once per spec.
//
// The alternative — a napi-rs / node-gyp addon — is the failure mode
// lib/sqlite.mjs already rejected for this repo in as many words: a native
// devDependency buys "a prebuild/rebuild failure mode on every `npm ci`". A
// spawned binary has no npm surface at all. `npm ci`, `npm run build` and
// `npm test` never learn that Rust exists; this file is the only thing that
// knows, and it says so plainly when the binary is not built.
//
// The shape also matches the Postgres driver, which likewise spawns a process
// per spec (psql). Neither engine gets a structural advantage in the comparison.
//
// WHO OWNS THE FILE
// -----------------
// Node creates the temp database, applies scripts/local-sqlite/schema.sql and
// the shared fixture through node:sqlite — the same code path the 54 constraint
// specs use — then hands the *path* to Rust, then re-opens the file on a fresh
// connection to run the state assertions. So:
//
//   * the verb is exercised against the VENDORED schema, not a copy the crate
//     keeps (the crate include_str!s this same file, so there is only one);
//   * the assertions read what is on DISK after the command committed, from a
//     connection that was not involved in writing it.

import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function scalar(row) {
  if (row === undefined || row === null) return 'NULL';
  const values = Object.values(row);
  if (values.length === 0) return 'NULL';
  const value = values[0];
  return value === null ? 'NULL' : String(value);
}

export class SqliteVerbEngine {
  #schemaSql;
  #fixtureSql;
  #binary;
  #dir = null;
  #count = 0;

  constructor({ schemaPath, fixturePath, binary }) {
    this.#schemaSql = readFileSync(schemaPath, 'utf8');
    this.#fixtureSql = readFileSync(fixturePath, 'utf8');
    this.#binary = binary;
  }

  get name() { return 'sqlite'; }

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
      const parsed = JSON.parse(result.stdout);
      return { ok: true, versions: parsed.result ?? {} };
    } catch (error) {
      return { ok: false, why: `unreadable --version output: ${error.message}` };
    }
  }

  open() {
    this.#dir = mkdtempSync(path.join(tmpdir(), 'wt-verb-sqlite-'));
    // Prove once, up front, that the schema this harness vendors is the schema
    // the specs run against and that it still applies.
    const probe = this.#newFile('schema-probe');
    const version = probe.db.prepare('SELECT sqlite_version() AS v').get().v;
    probe.db.close();
    this.#remove(probe.file);
    return { sqlite: String(version), node: process.version };
  }

  close() {
    if (this.#dir) { rmSync(this.#dir, { recursive: true, force: true }); this.#dir = null; }
  }

  #newFile(label) {
    const file = path.join(this.#dir, `${label}-${++this.#count}.db`);
    const db = new DatabaseSync(file);
    // DESIGN.md §2.1. Set before the schema; the Rust side sets AND asserts it
    // again on its own connection, which is where it actually matters.
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(this.#schemaSql);
    return { file, db };
  }

  #remove(file) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      rmSync(`${file}${suffix}`, { force: true });
    }
  }

  /**
   * @returns {{ outcome: 'ok'|'refused', code: string, message: string,
   *             row: object|null, state: Map<string,string> }}
   */
  run(spec) {
    const { file, db } = this.#newFile(spec.id.slice(0, 24));
    try {
      try {
        db.exec(this.#fixtureSql);
        if (spec.setup?.sqlite) db.exec(spec.setup.sqlite);
      } catch (error) {
        throw new Error(`setup failed: ${error.message}`);
      }
      db.close();

      const command = JSON.stringify({ verb: spec.command.verb, payload: spec.command.payload });
      const result = spawnSync(this.#binary, ['--db', file], { input: command, encoding: 'utf8' });

      if (result.status !== 0) {
        // A non-zero exit is a FAULT, never a refusal. The bridge prints a JSON
        // error body and exits 0 when the verb says no; it exits non-zero only
        // when the harness itself is broken.
        throw new Error(`bridge fault: ${(result.stderr || '').trim().split('\n')[0] || 'no output'}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(result.stdout);
      } catch (error) {
        throw new Error(`bridge produced unreadable output: ${error.message}`);
      }

      const outcome = parsed.ok ? 'ok' : 'refused';
      const row = parsed.ok ? (parsed.result?.transaction ?? null) : null;

      // Re-open on a FRESH connection: the assertions must read the file, not
      // the writer's view of it.
      const after = new DatabaseSync(file);
      after.exec('PRAGMA foreign_keys = ON');
      const state = new Map();
      try {
        for (const entry of spec.state ?? []) {
          state.set(entry.name, scalar(after.prepare(entry.sqlite).get()));
        }
      } finally {
        after.close();
      }

      return {
        outcome,
        code: parsed.error?.code ?? '',
        message: parsed.error?.message ?? '',
        row,
        state,
      };
    } finally {
      this.#remove(file);
    }
  }
}
