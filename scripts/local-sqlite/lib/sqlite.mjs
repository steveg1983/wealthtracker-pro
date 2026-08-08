// SQLite side of the differential harness.
//
// DRIVER: node:sqlite, the runtime's own binding. Chosen over better-sqlite3
// because this repo ships a browser bundle and a Vercel function set — adding a
// native, node-gyp-compiled devDependency for a schema harness buys a
// prebuild/rebuild failure mode on every `npm ci` in exchange for an API this
// harness does not need. The Phase 0 storage spike measured node:sqlite too, so
// the numbers in DESIGN.md §4 and the constraints proved here come from the same
// engine. The cost, stated so it is not a surprise: node:sqlite is flagged
// experimental in Node 22 and its SQLite is the one Node bundles (3.50.0 here),
// not the system CLI's (3.54.0) that the design's smoke test used. The runner
// prints both versions on every run, and asserts the features the schema needs.

import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** The lowest SQLite that can parse this schema: STRICT tables arrived in 3.37. */
const MIN_SQLITE = [3, 37, 0];

function versionTuple(text) {
  return text.split('.').map((n) => Number.parseInt(n, 10));
}

function scalar(row) {
  if (row === undefined || row === null) return 'NULL';
  const values = Object.values(row);
  if (values.length === 0) return 'NULL';
  const value = values[0];
  return value === null ? 'NULL' : String(value);
}

export class SqliteEngine {
  #schemaSql;
  #fixtureSql;
  #db = null;
  #dir = null;
  #freshCount = 0;

  constructor({ schemaPath, fixturePath }) {
    this.#schemaSql = readFileSync(schemaPath, 'utf8');
    this.#fixtureSql = readFileSync(fixturePath, 'utf8');
  }

  get name() { return 'sqlite'; }

  /**
   * Open the shared connection and apply the schema.
   * @returns {{ sqlite: string, node: string }}
   */
  open() {
    this.#dir = mkdtempSync(path.join(tmpdir(), 'wt-local-sqlite-'));
    this.#db = this.#newDatabase(path.join(this.#dir, 'harness.db'), []);
    const version = this.#db.prepare('SELECT sqlite_version() AS v').get().v;
    if (versionTuple(String(version)) < MIN_SQLITE) {
      throw new Error(`SQLite ${version} is too old for STRICT tables (need ${MIN_SQLITE.join('.')})`);
    }
    return { sqlite: String(version), node: process.version };
  }

  close() {
    if (this.#db) { this.#db.close(); this.#db = null; }
    if (this.#dir) { rmSync(this.#dir, { recursive: true, force: true }); this.#dir = null; }
  }

  #newDatabase(file, pragmaOverrides) {
    const db = new DatabaseSync(file);
    // PRAGMA foreign_keys defaults to OFF and is per connection — DESIGN.md §2.1
    // calls this "the single most likely silent failure in the whole port". Set
    // it before the schema, assert it after, and assert it again per spec.
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(this.#schemaSql);
    for (const pragma of pragmaOverrides) db.exec(pragma);
    return db;
  }

  /** Throws if foreign keys are not enforced on the given connection. */
  static assertForeignKeys(db, expected = 1) {
    const actual = db.prepare('PRAGMA foreign_keys').get().foreign_keys;
    if (Number(actual) !== expected) {
      throw new Error(`PRAGMA foreign_keys is ${actual}, expected ${expected}`);
    }
  }

  /**
   * Run one spec.
   * @returns {{ outcome: 'accepted'|'refused', message: string, verify: Map<string,string> }}
   */
  run(spec) {
    const block = spec.sqlite;
    return block.isolation === 'fresh-db' ? this.#runFresh(spec, block) : this.#runInTransaction(spec, block);
  }

  #runInTransaction(spec, block) {
    const db = this.#db;
    SqliteEngine.assertForeignKeys(db);
    db.exec('BEGIN');
    try {
      // Setup failures are harness bugs, not results: they must not be mistaken
      // for the constraint firing.
      try {
        db.exec(this.#fixtureSql);
        if (block.setup) db.exec(block.setup);
      } catch (error) {
        throw new Error(`setup failed: ${error.message}`);
      }
      return this.#act(db, spec, block);
    } finally {
      try { db.exec('ROLLBACK'); } catch { /* a RAISE(ROLLBACK) already closed it */ }
    }
  }

  #runFresh(spec, block) {
    // A spec needs its own file when it must COMMIT — deferred foreign keys are
    // only checked at commit, so a rolled-back transaction proves nothing about
    // them — or when it needs different connection pragmas.
    const file = path.join(this.#dir, `fresh-${++this.#freshCount}.db`);
    const db = this.#newDatabase(file, block.pragmas ?? []);
    try {
      try {
        db.exec(this.#fixtureSql);
        if (block.setup) db.exec(block.setup);
      } catch (error) {
        throw new Error(`setup failed: ${error.message}`);
      }
      return this.#act(db, spec, block);
    } finally {
      db.close();
      rmSync(file, { force: true });
      rmSync(`${file}-wal`, { force: true });
      rmSync(`${file}-shm`, { force: true });
    }
  }

  #act(db, spec, block) {
    let outcome = 'accepted';
    let message = '';
    try {
      db.exec(block.action);
    } catch (error) {
      outcome = 'refused';
      message = error.message;
    }
    const verify = new Map();
    if (outcome === 'accepted') {
      for (const entry of spec.verify ?? []) {
        if (entry.only && entry.only !== 'sqlite') continue;
        verify.set(entry.name, scalar(db.prepare(entry.sqlite).get()));
      }
    }
    return { outcome, message, verify };
  }
}
