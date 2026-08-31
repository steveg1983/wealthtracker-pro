/**
 * The licence, as a screen and as a line.
 *
 * ── IT REPORTS. IT DOES NOT ENFORCE ─────────────────────────────────────────
 *
 * Everything here is downstream of a decision made in Rust:
 * `apps/desktop/src-tauri/src/license.rs` checks the signature and
 * `main.rs`'s `licence_gate` refuses the writes. This screen cannot grant
 * anything and cannot take anything away — which is the whole reason it is safe
 * for it to live in a WebView at all, and the same argument `update.rs` makes
 * about self-updating one surface along.
 *
 * ── THE EXPLANATION IS THE SHELL'S SENTENCE, VERBATIM ───────────────────────
 *
 * `status.message` is prose the Rust wrote for a person — the consequence, then
 * the remedy — and it is rendered as it stands. What this file writes for itself
 * is only ever a LABEL: "Trial", "Read-only", a date. A label is a name for a
 * state; the explanation exists once, where the decision is made, so that the
 * two cannot drift into saying different things about the same afternoon.
 *
 * ── AND IT SAYS, EVERY TIME, THAT NOTHING IS BEING HELD ─────────────────────
 *
 * The landing page promises "your ledger exports in full whenever you want it".
 * A person reading this screen because their trial has ended is exactly the
 * person that promise was made to, so the read-only note says it again, in front
 * of them, rather than leaving them to discover it. Selling somebody software by
 * threatening their own accounts is not a business this product is in.
 *
 * ── WHERE IT APPEARS ────────────────────────────────────────────────────────
 *
 * Two places, both of them the window's own chrome rather than the shared app:
 *
 *   the CHOOSER   (`DesktopApp`) — before a ledger is open, so a key can be
 *                 entered on a machine that has just been set up;
 *   the LEDGER's  (`MountedLedger`'s index screen) — beside the sentence about
 *   own screen    whose copy this file is, which is where the window already
 *                 says what it is rather than what your money is.
 *
 * There is deliberately no ROUTE. `src/desktop/routes.ts` is a mirror of
 * `src/App.tsx` and `desktopRouter.test.tsx` fails an entry with no counterpart
 * there — for a good reason, since a manifest that could grow addresses of its
 * own would stop being a record of decisions about the web router's. A licence
 * is a property of the installation and not a page of the product, so it lives
 * in the chrome, as the ledger chooser does.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { Invoke } from '../services/local/coreTransport';
import {
  applyLicenceKey,
  formatLicenceDate,
  readLicenceStatus,
  type LicenceStatus
} from './licence';

/** A thrown thing, as a sentence. `DesktopApp`'s rule, and the same one. */
const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * A short name for a state.
 *
 * Written here rather than taken from the shell BECAUSE it is a label and not an
 * explanation — the shell's sentence is a paragraph, and a paragraph is not a
 * status line. The explanation is still the shell's, one element below.
 */
const label = (status: LicenceStatus): string => {
  switch (status.state) {
    case 'unenforced':
      return 'Development build';
    case 'expired':
      return 'Trial ended — read-only';
    case 'unlicensed':
      return 'No licence — read-only';
    case 'licensed':
      if (status.kind === 'trial' && status.expiresAt !== null) {
        return `Trial until ${formatLicenceDate(status.expiresAt)}`;
      }
      return status.licensedTo === null ? 'Licensed' : `Licensed to ${status.licensedTo}`;
  }
};

export interface LicencePanelProps {
  /** The shell's door. */
  readonly invoke: Invoke;
  /** Where the window stands, as last read. */
  readonly status: LicenceStatus;
  /** Called with the new state whenever a key is applied. */
  readonly onChanged: (status: LicenceStatus) => void;
  /** Fold the panel away again. */
  readonly onClose: () => void;
}

/** The licence, at full length: what it says, and a box to change it. */
export function LicencePanel({
  invoke,
  status,
  onChanged,
  onClose
}: LicencePanelProps): ReactElement {
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const apply = useCallback((): void => {
    setBusy(true);
    setProblem(null);
    applyLicenceKey(invoke, pasted)
      .then(next => {
        onChanged(next);
        setPasted('');
      })
      .catch((error: unknown) => setProblem(sentence(error)))
      .finally(() => setBusy(false));
  }, [invoke, onChanged, pasted]);

  return (
    <section className="licence-panel" aria-label="Licence">
      <h2>Licence</h2>

      {/* THE SHELL'S OWN SENTENCE. Not re-worded — see the header. */}
      <p>{status.message}</p>

      {status.state === 'licensed' && status.kind === 'trial' && status.expiresAt !== null ? (
        <p>Your trial runs until {formatLicenceDate(status.expiresAt)}.</p>
      ) : null}

      {status.mayWrite ? null : (
        // THE PROMISE, restated to the one person who most needs to hear it.
        <p className="licence-open">
          Nothing is being held back. Every screen still reads, every report still runs, and the
          Export screen still takes the whole ledger — the file is yours whether this app is
          licensed or not. What is paused is writing: adding, editing and importing.
        </p>
      )}

      {status.clockWentBack ? (
        <p>
          This machine’s clock reads earlier than the last time the app ran, so any trial is
          counted from the later of the two. If the clock was simply wrong, setting it correctly
          costs you nothing.
        </p>
      ) : null}

      <label htmlFor="licence-key">Licence key</label>
      <textarea
        id="licence-key"
        rows={3}
        spellCheck={false}
        value={pasted}
        placeholder="WTL1-…"
        onChange={event => setPasted(event.target.value)}
      />

      {problem === null ? null : (
        <p role="alert" className="problem">
          {problem}
        </p>
      )}

      <div className="actions">
        <button type="button" onClick={apply} disabled={busy || pasted.trim() === ''}>
          Apply licence
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}

export interface LicenceStatusLineProps {
  /** The shell's door, or `null` when this window has none. */
  readonly invoke: Invoke | null;
}

/**
 * One line about the licence, and the panel behind it.
 *
 * Renders NOTHING at all when there is no shell to ask or the shell answered
 * something this build cannot read. `licence.ts`'s header argues that silence:
 * a window that cannot tell should not say anything, and it changes nothing
 * about what may be written, because that was never decided here.
 */
export function LicenceStatusLine({ invoke }: LicenceStatusLineProps): ReactElement | null {
  const [status, setStatus] = useState<LicenceStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (invoke === null) return;
    let cancelled = false;
    void readLicenceStatus(invoke).then(answer => {
      if (!cancelled) setStatus(answer);
    });
    return () => {
      cancelled = true;
    };
  }, [invoke]);

  if (invoke === null || status === null) return null;

  return (
    <div className="licence">
      <p className="licence-line">
        {label(status)}{' '}
        <button type="button" onClick={() => setOpen(was => !was)} aria-expanded={open}>
          {open ? 'Hide licence' : 'Manage licence'}
        </button>
      </p>
      {open ? (
        <LicencePanel
          invoke={invoke}
          status={status}
          onChanged={setStatus}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
