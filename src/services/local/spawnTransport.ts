/**
 * The CLI, driven as a process — the differential harness's transport, and NOT
 * the application's.
 *
 * ── WHY IT IS A MODULE OF ITS OWN ───────────────────────────────────────────
 *
 * It imports `node:child_process`. `coreTransport.ts` is imported by the DESKTOP
 * — `deviceDocument.ts` reaches it in two hops — and a module that names a Node
 * built-in in a graph a browser engine has to bundle is a build failure waiting
 * for the first person who runs it. Splitting the two transports costs one file
 * and makes the property structural: `deviceDocument.cloudFree.test.ts` walks
 * that graph and this module is not in it.
 *
 * The split says something true as well. There are two transports because there
 * are two callers with two mechanisms (PHASE3-PLAN D-3), and only one of them is
 * a program somebody runs.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * It is the only way to drive the real crate from Node without adding a native,
 * node-gyp-compiled devDependency, which `scripts/local-sqlite/lib/sqlite.mjs`
 * rejected for this repo in as many words: it *"buys a prebuild/rebuild failure
 * mode on every `npm ci`"*. A spawned binary has zero npm surface — `npm ci`,
 * `npm run build` and `npm test` never learn Rust exists.
 *
 * ── AND WHY THE APPLICATION MUST NOT USE IT ─────────────────────────────────
 *
 * A spawn costs 2.50 ms median (measured, 40 runs after 3 warm-ups; see
 * `bin/wealth_core_cli.rs`), so renaming three thousand payees would be seven
 * and a half seconds of `fork`/`exec` — and, worse, each child holds the real
 * ledger for the length of its own life. That measurement is exactly why D-3
 * chose an in-process Tauri command for the shell, which is
 * `createInvokeTransport` and lives beside the envelope it shares with this one.
 * This is fine for a spec and wrong for a user, and saying so here is cheaper
 * than finding out.
 *
 * It is `spawnSync` rather than `spawn` for the same reason: a spec wants the
 * answer, not concurrency, and the shell will never call it.
 */

import { spawnSync } from 'node:child_process';

import { fault, readEnvelope, type CoreTransport } from './coreTransport';

export interface SpawnTransportOptions {
  /** Path to a built `wealth-core-cli` (the crate's `--features cli` binary). */
  binary: string;
  /** The ledger file every call is asked of. */
  database: string;
}

export function createSpawnTransport(options: SpawnTransportOptions): CoreTransport {
  return {
    call(verb: string, payload: unknown): Promise<unknown> {
      const command = JSON.stringify({ verb, payload });
      const result = spawnSync(options.binary, ['--db', options.database], {
        input: command,
        encoding: 'utf8',
        // A read verb's answer is a WHOLE LEDGER. Node's 1 MB default would
        // truncate `load_boot` at a few thousand transactions and hand back
        // valid-looking JSON that stops mid-row, which is the worst possible
        // failure: 64 MB is comfortably past the 50,000-row answer measured in
        // `tests/reads_at_scale.rs`, and overflowing it is reported as a fault
        // rather than swallowed.
        maxBuffer: 64 * 1024 * 1024
      });

      if (result.error) {
        return Promise.reject(fault(verb, result.error.message));
      }
      if (result.status !== 0) {
        const stderr = (result.stderr ?? '').trim().split('\n')[0];
        return Promise.reject(fault(verb, stderr === '' ? 'the bridge exited non-zero' : stderr));
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unreadable output';
        return Promise.reject(fault(verb, detail));
      }

      try {
        return Promise.resolve(readEnvelope(verb, parsed));
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
}
