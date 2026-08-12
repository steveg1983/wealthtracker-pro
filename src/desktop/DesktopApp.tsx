/**
 * The desktop edition's application shell.
 *
 * ── WHAT MAKES THIS THE "DESKTOP ROUTER" AND NOT A SECOND APP ───────────────
 *
 * The routes are not written here. They are in `routes.ts`, as a decision with
 * a reason attached to every path the web router has, and `MountedLedger`
 * renders whichever of them are mounted. That indirection is the whole gating
 * mechanism: a route can only appear in this window by being added to
 * `DESKTOP_ROUTES`, and a route cannot be added to `DESKTOP_ROUTES` while it is
 * also in `NEVER_ON_A_DESKTOP` — `__tests__/desktopRouter.test.tsx` fails on
 * exactly that, which is what stops a bank-feed page from arriving here by being
 * convenient one afternoon.
 *
 * There is no `ClerkProvider`, no `SubscriptionProvider` and no `AuthProvider`,
 * and their absence is not a subtraction from `App.tsx` — it is that nothing in
 * this window's graph reaches them. The identity question they answer for a
 * browser is answered here by the file itself (`deviceIdentity.ts`), which is
 * why the first screen is a chooser rather than a sign-in.
 *
 * ── THE LAZY IMPORT IS THE MOST IMPORTANT LINE IN THIS FILE ─────────────────
 *
 * `MountedLedger` is `lazy(() => import('./MountedLedger'))` and it may not
 * become a static import. `@data` resolves to `services/local/deviceDataPort.ts`
 * in this build, and that module's SCOPE is `requireDeviceDocument().port` — it
 * throws if no ledger is open. Every provider and every page below it reaches
 * `@data`, so importing any of them before a file has been chosen is a blank
 * window with a thrown sentence in a console nobody can see.
 *
 * That is not a workaround; it is the ordering rule `deviceDataPort.ts` states
 * outright — *"the application's module graph is loaded after the ledger is
 * open"* — and this is the file that keeps it. Choose the file, open the
 * document, seed and attach, and only then pull the application in.
 *
 * ── HashRouter, AND WHY NOT BrowserRouter ───────────────────────────────────
 *
 * The web app runs on a server that can answer any path with `index.html`. This
 * one runs on `tauri://localhost`, a custom protocol serving a directory of
 * files, where a reload at `/accounts` is a request for a file that is not
 * there. A hash keeps the whole address inside the document the shell embedded,
 * which is the only address a window ever really has.
 *
 * ── ONE OPEN DOCUMENT, HELD BY THE WINDOW ───────────────────────────────────
 *
 * The shell holds the file behind a mutex and this component holds the app's
 * view of it. Both are single: `main.rs`'s mutex is why the app cannot race
 * itself, and this is why the window cannot show two ledgers. Opening a second
 * one replaces the first here exactly as it does there.
 */

import { Suspense, lazy, useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  bootDeviceLedger,
  openDeviceDocument,
  type OpenLedger
} from '../services/local/deviceDocument';
// The one singleton every surface renders through, handed to the boot so the
// settings come out of the FILE rather than out of this WebView's localStorage.
// `bootDeviceLedger` takes it as an injected structural interface rather than
// importing it, so that the data layer names no app service; this is the
// injector, and until the mount's second half there was nobody to be one. The
// obligation is recorded in `DeviceBootOptions` and in the shell's README, and
// it is discharged here.
import { preferences } from '../services/preferencesService';
import type { Invoke } from '../services/local/coreTransport';
import { LedgerChooser } from './LedgerScreen';

/**
 * The application, and everything it reaches. See the header: this import may
 * not be made static, and the failure if it is would be a blank window.
 */
const MountedLedger = lazy(() => import('./MountedLedger'));

export interface DesktopAppProps {
  /** The shell's one door. See `tauriShell.ts`. */
  readonly invoke: Invoke;
}

/** A thrown thing, as a sentence. See `LedgerChooser`'s `problem` for the rule. */
const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function DesktopApp({ invoke }: DesktopAppProps): ReactElement {
  /** Where the open ledger is, or `null` when none is. The mount's one switch. */
  const [ledgerPath, setLedgerPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const openFrom = useCallback(
    async (answer: OpenLedger): Promise<void> => {
      const document = openDeviceDocument({ ledger: answer, invoke });
      // Seeds the categories and binds the settings to the file — and does NOT
      // read the ledger. The application does that, through `@data`, in the
      // state layer's own boot effect; reading it here as well would mean
      // materialising a whole history twice to open one window.
      await bootDeviceLedger(document, { preferences });
      setLedgerPath(answer.path);
    },
    [invoke]
  );

  const choose = useCallback(
    (command: 'open_ledger' | 'create_ledger') => (): void => {
      setBusy(true);
      setProblem(null);
      void invoke(command, {})
        .then(answer => openFrom(answer as OpenLedger))
        .catch((error: unknown) => setProblem(sentence(error)))
        .finally(() => setBusy(false));
    },
    [invoke, openFrom]
  );

  // A window that already has a ledger. The shell keeps the DOCUMENT, not the
  // page — `main.rs`'s mutex outlives any reload of the WebView — so a window
  // that reloads finds its file still open, still locked, and does not ask
  // again. Without this the person would be shown a chooser for a ledger they
  // never closed, and choosing it again would be refused by the shell's own
  // lock, correctly and incomprehensibly.
  useEffect(() => {
    let cancelled = false;
    void invoke('current_ledger', {})
      .then(answer => {
        if (cancelled || answer === null || answer === undefined) return;
        return openFrom(answer as OpenLedger);
      })
      .catch((error: unknown) => {
        if (!cancelled) setProblem(sentence(error));
      });
    return () => {
      cancelled = true;
    };
  }, [invoke, openFrom]);

  if (ledgerPath === null) {
    // No router at all, deliberately: there is nowhere to go. Every address this
    // window serves is an address inside a ledger, and the chooser is what a
    // window shows when it does not have one.
    return (
      <LedgerChooser
        busy={busy}
        problem={problem}
        onOpen={choose('open_ledger')}
        onCreate={choose('create_ledger')}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <main className="ledger-screen">
          <h1>WealthTracker</h1>
          <p>Opening {ledgerPath}…</p>
        </main>
      }
    >
      <MountedLedger />
    </Suspense>
  );
}
