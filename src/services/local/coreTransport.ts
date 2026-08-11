/**
 * The one door between TypeScript and the ledger crate.
 *
 * Everything `LocalDataPort` asks a file goes through the interface below:
 * one verb string, one payload, one answer. There is no second door and no
 * query language — DESIGN.md §6.4, *"There is no command that accepts a SQL
 * string. You cannot bypass what does not exist."*
 *
 * ── WHY THE TRANSPORT IS INJECTED RATHER THAN IMPORTED ──────────────────────
 *
 * PHASE3-PLAN D-3. There are two callers of the crate's command surface and
 * they reach it by completely different mechanisms:
 *
 *   the desktop shell   one `#[tauri::command] wealth_core_invoke(verb, payload)`
 *                       in the same process as the ledger (measured 0.145–0.162 ms
 *                       per invoke);
 *   this repo's harness a spawned `wealth-core-cli` per call, JSON on stdin,
 *                       JSON on stdout (measured 2.50 ms median).
 *
 * A port that imported one of them could only ever be tested through that one.
 * So the port takes a {@link CoreTransport} and knows nothing about processes,
 * windows or IPC; the two implementations differ only in how the bytes travel,
 * and they answer in the SAME envelope, so the semantics below are written
 * once and obeyed by both.
 *
 * ── THE ENVELOPE, AND THE ONE DISTINCTION IT MAKES ──────────────────────────
 *
 * ```text
 * {"ok":true,  "result": …}
 * {"ok":false, "error": {"code": …, "message": …, "hint": …}}
 * ```
 *
 * A REFUSAL is an answer. The ledger was asked to do something and said no, in
 * words: `crates/wealth-core/src/command.rs`'s `respond` puts it in that second
 * shape with `ok:false`, and the file is intact.
 *
 * A FAULT is not an answer. The file would not open, the binary is not there,
 * the pipe broke. The crate's own commentary draws the line in as many words —
 * *"A non-zero exit is a FAULT, never a refusal"* — and both callers show a
 * fault out by their own door: a non-zero exit here, a rejected `invoke` in the
 * shell.
 *
 * BOTH ARRIVE AT THE CALLER AS A REJECTED PROMISE, and that is deliberate
 * rather than a loss of information. Seam rule 4 (`dataPort.ts`) says an error's
 * `.message` is user-facing prose, rendered straight into the UI in ~28 places.
 * A refusal's message already IS that prose — the crate wrote it for a person —
 * so it is passed through UNCHANGED: not prefixed, not wrapped, not re-worded.
 * A fault gets a sentence of its own, written here, because the crate had no
 * chance to write one. Either way the caller has one thing to do with it, which
 * is why `LocalDataPort` contains not one branch on the difference.
 *
 * ── `code` AND `hint` RIDE ALONG, NON-ENUMERABLY ────────────────────────────
 *
 * The seam permits a machine code beside the prose and forbids any caller from
 * branching on it (`dataPort.ts` rule 4). Attaching them as ORDINARY properties
 * would make that a request rather than a rule: they would show up in
 * `JSON.stringify(error)`, in an object spread, in a logged payload, and in the
 * first `if (error.code === …)` somebody reaches for. Non-enumerable means they
 * are there for a debugger and for a future typed-error slice (PHASE3-PLAN §9
 * keeps that decision out until a caller needs it), and invisible to everything
 * that walks an object.
 */

import { spawnSync } from 'node:child_process';

/**
 * One question for an open ledger.
 *
 * `payload` is whatever the verb's Rust struct deserialises — and serde is the
 * gate: an unknown verb or an unrecognised field is refused before a connection
 * is touched (`command.rs`'s `parse` runs before anything is opened). So this
 * signature is deliberately not generic: the crate is the type system here, and
 * a TypeScript generic promising otherwise would be a second, weaker copy of it.
 *
 * Resolves with the verb's `result` (the crate wraps every read's answer in
 * `{ answer: … }` and every write's in `{ transaction: … }`); rejects with an
 * `Error` whose `.message` is either the ledger's own refusal prose or this
 * module's fault sentence.
 */
export interface CoreTransport {
  call(verb: string, payload: unknown): Promise<unknown>;
}

/** The refusal body the crate serialises. `hint` is omitted when there is none. */
interface ErrorBody {
  code: string;
  message: string;
  hint?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readErrorBody = (value: unknown): ErrorBody | null => {
  if (!isRecord(value)) return null;
  const { code, message, hint } = value;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return typeof hint === 'string' ? { code, message, hint } : { code, message };
};

/**
 * A refusal as the app's one error shape.
 *
 * `message` verbatim, for the reason the module header gives. `code` and `hint`
 * are defined rather than assigned so they can be made non-enumerable — the
 * only way to attach a value that a debugger can see and `JSON.stringify`
 * cannot.
 */
const refusal = (body: ErrorBody): Error => {
  const error = new Error(body.message);
  Object.defineProperty(error, 'code', {
    value: body.code,
    enumerable: false,
    writable: false,
    configurable: true
  });
  if (body.hint !== undefined) {
    Object.defineProperty(error, 'hint', {
      value: body.hint,
      enumerable: false,
      writable: false,
      configurable: true
    });
  }
  return error;
};

/**
 * A fault as the app's one error shape.
 *
 * Named `[verb]` rather than left bare because the sentence reaches a person:
 * "the ledger could not be read" with no indication of what was being asked is
 * the kind of message that costs an afternoon.
 */
const fault = (verb: string, detail: string): Error =>
  new Error(`The ledger file could not answer ${verb}: ${detail}`);

/**
 * Turn one envelope into a value or an error, whichever it holds.
 *
 * Exported because BOTH transports must read the envelope the same way. The
 * shell's `invoke` and this file's `spawnSync` differ in how a fault arrives
 * (a rejected promise there, a non-zero exit here) and not at all in what an
 * answer looks like, so the answer-reading lives here once.
 *
 * @throws the ledger's own refusal, or a fault when what came back is not an
 * envelope at all — an unparseable answer is a broken transport, not a no.
 */
export function readEnvelope(verb: string, envelope: unknown): unknown {
  if (!isRecord(envelope) || typeof envelope.ok !== 'boolean') {
    return raise(fault(verb, 'the answer was not in the {ok,…} envelope'));
  }
  if (envelope.ok) return envelope.result;

  const body = readErrorBody(envelope.error);
  if (body === null) {
    return raise(fault(verb, 'the refusal carried no message'));
  }
  return raise(refusal(body));
}

/**
 * `throw` as an expression, so the reader above stays one shape.
 *
 * @throws whatever it is given — always.
 */
const raise = (error: Error): never => {
  throw error;
};

export interface SpawnTransportOptions {
  /** Path to a built `wealth-core-cli` (the crate's `--features cli` binary). */
  binary: string;
  /** The ledger file every call is asked of. */
  database: string;
}

/**
 * The CLI, driven as a process — the differential harness's transport, and NOT
 * the application's.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * It is the only way to drive the real crate from Node without adding a
 * native, node-gyp-compiled devDependency, which `scripts/local-sqlite/lib/
 * sqlite.mjs` rejected for this repo in as many words: it *"buys a
 * prebuild/rebuild failure mode on every `npm ci`"*. A spawned binary has zero
 * npm surface — `npm ci`, `npm run build` and `npm test` never learn Rust
 * exists.
 *
 * ── AND WHY THE APPLICATION MUST NOT USE IT ─────────────────────────────────
 *
 * A spawn costs 2.50 ms median (measured, 40 runs after 3 warm-ups; see
 * `bin/wealth_core_cli.rs`), so renaming three thousand payees would be seven
 * and a half seconds of `fork`/`exec` — and, worse, each child holds the real
 * ledger for the length of its own life. That measurement is exactly why D-3
 * chose an in-process Tauri command for the shell. This one is fine for a spec
 * and wrong for a user, and saying so here is cheaper than finding out.
 *
 * It is `spawnSync` rather than `spawn` for the same reason: a spec wants the
 * answer, not concurrency, and the shell will never call it.
 */
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
