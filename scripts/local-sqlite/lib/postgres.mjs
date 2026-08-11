// Postgres side of the differential harness.
//
// It drives the EXISTING cluster from scripts/local-db (`bash scripts/local-db/
// up.sh`) — a throwaway Postgres with the whole migration history applied. That
// harness is a shell script that runs *.test.sql files and greps their output,
// which is the right shape for a hand-written SQL test and the wrong shape for a
// spec that has to report accepted-vs-refused per statement. So this file talks
// to the same cluster with the same conventions (WT_PGBIN, WT_PGDATA, WT_PGPORT,
// LC_ALL=C) and drives psql itself.
//
// NOTHING under scripts/local-db is modified. The two harnesses share a cluster
// and nothing else.

import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SETUP_OK = '__SETUP_OK__';
const ACTION_OK = '__ACTION_OK__';
const VERIFY = '__V__';

/**
 * `WT_PGBIN` first, because it is what scripts/local-db/pgbin.sh exports after
 * finding the cluster's own binaries — on Linux those are under
 * /usr/lib/postgresql/<major>/bin and not on PATH at all. The homebrew path
 * stays as the macOS default so a developer who never sets anything is
 * unaffected, and PATH last so a psql already there still wins over nothing.
 */
function psqlEnv() {
  const prefix = [process.env.WT_PGBIN, '/opt/homebrew/opt/postgresql@17/bin'].filter(Boolean);
  return {
    ...process.env,
    PATH: [...prefix, process.env.PATH ?? ''].join(':'),
    // scripts/local-db/pgbin.sh sets this and says why: without it macOS aborts
    // the server with "postmaster became multithreaded during startup", and the
    // resulting SQL_ASCII cluster is what spec x1-* is written against.
    LC_ALL: 'C',
  };
}

export class PostgresEngine {
  #fixtureSql;
  #host;
  #port;
  #tmp;

  constructor({ fixturePath }) {
    this.#fixtureSql = readFileSync(fixturePath, 'utf8');
    this.#host = process.env.WT_PGDATA ?? '/tmp/wtpg';
    this.#port = process.env.WT_PGPORT ?? '55432';
    this.#tmp = path.join(tmpdir(), `wt-local-pg-${process.pid}.sql`);
  }

  get name() { return 'postgres'; }

  /** @returns {{ ok: true, version: string, encoding: string } | { ok: false, why: string }} */
  probe() {
    const result = this.#psql(['-c', "SELECT version() || '|' || current_setting('server_encoding')"]);
    if (result.status !== 0) {
      return {
        ok: false,
        why: (result.stderr || result.error?.message || 'psql failed').trim().split('\n')[0],
      };
    }
    const line = result.stdout.trim().split('\n')[0] ?? '';
    const [version, encoding] = line.split('|');
    return { ok: true, version: (version ?? '').split(' on ')[0], encoding: encoding ?? 'unknown' };
  }

  #psql(extra) {
    return spawnSync(
      'psql',
      ['-X', '-q', '-A', '-t', '-h', this.#host, '-p', this.#port, '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', ...extra],
      { env: psqlEnv(), encoding: 'utf8' },
    );
  }

  run(spec) {
    const block = spec.postgres;
    const lines = [
      'BEGIN;',
      this.#fixtureSql,
      block.setup ?? '',
      `\\echo ${SETUP_OK}`,
      block.action,
      `\\echo ${ACTION_OK}`,
    ];
    for (const entry of spec.verify ?? []) {
      if (entry.only && entry.only !== 'postgres') continue;
      lines.push(`\\echo ${VERIFY}${entry.name}`);
      lines.push(entry.postgres.trim().endsWith(';') ? entry.postgres : `${entry.postgres};`);
    }
    lines.push('ROLLBACK;');

    writeFileSync(this.#tmp, `${lines.join('\n')}\n`, 'utf8');
    let result;
    try {
      result = this.#psql(['-f', this.#tmp]);
    } finally {
      try { unlinkSync(this.#tmp); } catch { /* already gone */ }
    }

    const stdout = result.stdout ?? '';
    const stderr = (result.stderr ?? '').trim();

    if (!stdout.includes(SETUP_OK)) {
      // The fixture or the setup broke. That is a harness bug and must never be
      // reported as "the constraint fired".
      throw new Error(`setup failed: ${stderr.split('\n').slice(0, 3).join(' / ') || 'no output'}`);
    }
    if (!stdout.includes(ACTION_OK)) {
      return { outcome: 'refused', message: stderr, verify: new Map() };
    }

    const verify = new Map();
    const after = stdout.slice(stdout.indexOf(ACTION_OK) + ACTION_OK.length).split('\n');
    for (let i = 0; i < after.length; i += 1) {
      const line = after[i].trim();
      if (!line.startsWith(VERIFY)) continue;
      const name = line.slice(VERIFY.length);
      const value = (after[i + 1] ?? '').trim();
      verify.set(name, value === '' ? 'NULL' : value);
    }
    return { outcome: 'accepted', message: '', verify };
  }
}
