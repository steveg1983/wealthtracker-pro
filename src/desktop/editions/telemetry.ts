/**
 * `@telemetry`, on a device: this machine, and nowhere else.
 *
 * The device half of `editions/telemetry.ts`, and the twin of
 * `editions/cloud/telemetry.ts`. A desktop edition still has errors and still
 * wants a record of them — what it does not have, and must be unable to have, is
 * somewhere to SEND them. So these two do exactly what the cloud's do when
 * `VITE_ENABLE_ERROR_TRACKING` is off (see `lib/sentry.ts`, which logs and
 * returns): they write to the window's console and stop.
 *
 * ── WHY A CONSOLE AND NOT A FILE, YET ───────────────────────────────────────
 *
 * A crash log next to the ledger is a real thing to want, and it is not this
 * slice's to invent: writing one means a Tauri command, a path decision, a
 * rotation policy and a promise about what is in it — a program that keeps a
 * file of everything that ever went wrong beside a file of somebody's money owes
 * them a sentence about both. The console is the honest interim: it is what the
 * shell's own webview inspector shows, it costs nothing, and it leaves the
 * decision where it belongs rather than making it by accident here.
 *
 * ── IT IS NOT A NO-OP, AND THAT IS DELIBERATE ───────────────────────────────
 *
 * The tempting version of this file is two empty functions. It would pass every
 * check in `docs/edition-gating.md` and it would mean that on the one edition
 * with no error reporting at all, a caught exception vanishes. `loggingService`
 * hands its worst news to these two; they are the last thing holding it.
 */

import type { CaptureException, CaptureMessage } from '../../editions/telemetry';

/** The same list the cloud half re-exports. */
export type { CaptureException, CaptureMessage, TelemetryContext, TelemetryLevel } from '../../editions/telemetry';

export const captureException: CaptureException = (error, context) => {
  // `console.error` rather than the app's logger: this module is what the
  // logger's own sink resolves to, so calling it back would be a loop.
  console.error('[wealthtracker]', error.message, { error, ...(context ?? {}) });
};

export const captureMessage: CaptureMessage = (message, level = 'info', context) => {
  const write = level === 'fatal' || level === 'error' ? console.error : console.warn;
  write('[wealthtracker]', `[${level}] ${message}`, context ?? {});
};
