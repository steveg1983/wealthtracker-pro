/**
 * What the renderer is allowed to know about the licence, and how it asks.
 *
 * ── THIS MODULE DECIDES NOTHING ─────────────────────────────────────────────
 *
 * It reads. `apps/desktop/src-tauri/src/license.rs` verifies the signature and
 * `main.rs` refuses the writes, both in Rust, both before a WebView is involved
 * — the same placement argument `update.rs` makes about self-updating, applied a
 * second time: *"the WebView is not the part of this program that should be able
 * to replace the program"*, nor the part that should be able to decide it is
 * licensed.
 *
 * So there is no verification here, no expiry arithmetic, no `mayWrite` computed
 * from a date. Every one of those would be a second opinion, and a second
 * opinion is a thing that can disagree — usually in the direction of the person
 * who edited it. What this file does is ask the shell where it stands and give
 * the answer a type.
 *
 * ── THE SENTENCE IS THE SHELL'S, VERBATIM ───────────────────────────────────
 *
 * {@link LicenceStatus.message} is prose the Rust wrote for a person, and it is
 * rendered as it stands: not prefixed, not re-worded, not replaced by a friendlier
 * one. That is `dataPort.ts` rule 4 applied to a second engine — the sentence
 * that says the consequence and the remedy exists once, where the decision is
 * made, so that a person meets one explanation rather than two that drift.
 *
 * ── A SHELL THAT ANSWERS SOMETHING ELSE IS SILENCE, NOT AN ALARM ────────────
 *
 * {@link readLicenceStatus} answers `null` rather than throwing when what comes
 * back is not a status. A renderer opened outside the app, a shell too old to
 * have the command, a test harness answering every `invoke` with a stub: none of
 * those is a person's problem and none of them is worth a banner. The licence
 * line simply does not appear, which is the correct amount of noise for "this
 * window cannot tell", and the ENFORCEMENT is unaffected either way because it
 * was never here.
 */

import type { Invoke } from '../services/local/coreTransport';

/** Where a window stands. `license.rs`'s `State`, as it serialises. */
export type LicenceState = 'unenforced' | 'licensed' | 'expired' | 'unlicensed';

/** What was bought. `license.rs`'s `Kind`. */
export type LicenceKind = 'trial' | 'lifetime';

/** The shell's answer to "where do I stand?". */
export interface LicenceStatus {
  readonly state: LicenceState;
  /** Trial or lifetime, when there is a licence at all. */
  readonly kind: LicenceKind | null;
  /** The licensee's name, for "Licensed to …". */
  readonly licensedTo: string | null;
  /**
   * When a trial ends, in SECONDS since the Unix epoch.
   *
   * Seconds rather than a date string because the shell has no calendar in it
   * and deliberately does not want one (`license.rs` argues that where the claim
   * is declared). Formatting a date is this side's job, and this side already
   * has an en-GB locale to do it in.
   */
  readonly expiresAt: number | null;
  /** Whether writes are permitted. The one thing anything here branches on. */
  readonly mayWrite: boolean;
  /** Whether this machine's clock reads earlier than the highest instant this
   *  installation has seen. Reported, never punished. */
  readonly clockWentBack: boolean;
  /** The sentence a person reads, written by the shell. Rendered verbatim. */
  readonly message: string;
}

const STATES: readonly string[] = ['unenforced', 'licensed', 'expired', 'unlicensed'];
const KINDS: readonly string[] = ['trial', 'lifetime'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read one status out of whatever `invoke` handed back.
 *
 * A guard rather than a cast, for `tauriShell.ts`'s reason one level along: the
 * value crosses a process boundary, so a renderer that assumed its shape would
 * fail with `undefined is not an object` in a window with no console open.
 */
const asStatus = (value: unknown): LicenceStatus | null => {
  if (!isRecord(value)) return null;
  const { state, kind, licensedTo, expiresAt, mayWrite, clockWentBack, message } = value;
  if (typeof state !== 'string' || !STATES.includes(state)) return null;
  if (typeof mayWrite !== 'boolean' || typeof message !== 'string') return null;
  return {
    state: state as LicenceState,
    kind: typeof kind === 'string' && KINDS.includes(kind) ? (kind as LicenceKind) : null,
    licensedTo: typeof licensedTo === 'string' ? licensedTo : null,
    expiresAt: typeof expiresAt === 'number' ? expiresAt : null,
    mayWrite,
    clockWentBack: clockWentBack === true,
    message
  };
};

/** Where this window stands, or `null` when it cannot tell. See the header. */
export const readLicenceStatus = async (invoke: Invoke): Promise<LicenceStatus | null> => {
  try {
    return asStatus(await invoke('license_status', {}));
  } catch {
    return null;
  }
};

/**
 * Hand a pasted key to the shell, and take back where that leaves us.
 *
 * @throws an `Error` whose `.message` is the shell's own sentence about what is
 * wrong with the key — a truncated paste, a key for another product, a trial
 * signed by a key this build does not carry. It is shown verbatim.
 */
export const applyLicenceKey = async (invoke: Invoke, key: string): Promise<LicenceStatus> => {
  let answer: unknown;
  try {
    answer = await invoke('license_apply', { key });
  } catch (error) {
    // Tauri rejects a command with its `Err` value, which for this shell is
    // always a string. Read defensively anyway: the IPC can reject on its own
    // account before a command runs, and `[object Object]` teaches nobody
    // anything.
    if (typeof error === 'string' && error !== '') throw new Error(error);
    if (error instanceof Error && error.message !== '') throw error;
    throw new Error('The app could not check that licence key. Try again.');
  }
  const status = asStatus(answer);
  if (status === null) {
    throw new Error('The app could not read its own answer about that licence key.');
  }
  return status;
};

/**
 * A date, the way this app says dates.
 *
 * `en-GB` hard-coded, exactly as `utils/dateFormatter` does it: there is no US
 * edition to be consistent with, and a trial that ends on 03/04/2027 must not be
 * readable as two different days.
 */
export const formatLicenceDate = (epochSeconds: number): string =>
  new Date(epochSeconds * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
