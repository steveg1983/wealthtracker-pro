/**
 * The desktop edition's application shell.
 *
 * ── WHAT MAKES THIS THE "DESKTOP ROUTER" AND NOT A SECOND APP ───────────────
 *
 * The routes are not written here. They are in `routes.ts`, as a decision with
 * a reason attached to every path the web router has, and this file renders
 * whichever of them are mounted. That indirection is the whole gating
 * mechanism: a route can only appear in this window by being added to
 * {@link DESKTOP_ROUTES}, and a route cannot be added to `DESKTOP_ROUTES` while
 * it is also in `NEVER_ON_A_DESKTOP` — `__tests__/desktopRouter.test.tsx` fails
 * on exactly that, which is what stops a bank-feed page from arriving here by
 * being convenient one afternoon.
 *
 * There is no `ClerkProvider`, no `SubscriptionProvider` and no `AuthProvider`,
 * and their absence is not a subtraction from `App.tsx` — it is that nothing in
 * this window's graph reaches them. The identity question they answer for a
 * browser is answered here by the file itself (`deviceIdentity.ts`), which is
 * why the first screen is a chooser rather than a sign-in.
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

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  bootDeviceLedger,
  openDeviceDocument,
  type OpenLedger
} from '../services/local/deviceDocument';
import type { Invoke } from '../services/local/coreTransport';
import { LedgerScreen, type OpenLedgerView } from './LedgerScreen';
import { DESKTOP_ROUTES, type DesktopPath } from './routes';

export interface DesktopAppProps {
  /** The shell's one door. See `tauriShell.ts`. */
  readonly invoke: Invoke;
}

/** A thrown thing, as a sentence. See `LedgerScreen`'s `problem` for the rule. */
const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function DesktopApp({ invoke }: DesktopAppProps): ReactElement {
  const [ledger, setLedger] = useState<OpenLedgerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const openFrom = useCallback(
    async (answer: OpenLedger): Promise<void> => {
      const document = openDeviceDocument({ ledger: answer, invoke });
      // No preferences service is passed, and it is still honest rather than
      // unfinished: this window renders one surface and that surface reads no
      // setting. It has a measured reason now, too — `preferencesService.ts`
      // reaches a Supabase client in its module scope, so a desktop bundle
      // cannot import it, and giving this window the app's settings means
      // giving that service a seam of the kind the data layer just got. The
      // obligation is recorded at `bootDeviceLedger` and in the shell's README.
      const boot = await bootDeviceLedger(document);
      setLedger({ path: answer.path, boot, capabilities: document.port.capabilities() });
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

  /**
   * A screen for every mounted path, checked by the compiler.
   *
   * `Record<DesktopPath, …>` is what makes `routes.ts` load-bearing rather than
   * documentation: adding a path to the manifest without adding it here does not
   * build.
   */
  const screens: Record<DesktopPath, ReactElement> = {
    '/': (
      <LedgerScreen
        ledger={ledger}
        busy={busy}
        problem={problem}
        onOpen={choose('open_ledger')}
        onCreate={choose('create_ledger')}
      />
    )
  };

  return (
    <HashRouter>
      <Routes>
        {DESKTOP_ROUTES.map(route => (
          <Route key={route.path} path={route.path} element={screens[route.path]} />
        ))}
        {/* A window has no address bar, so an unknown address is never something
            a person typed — it is this program having sent itself somewhere that
            does not exist. It goes home rather than rendering a "not found" page
            that would be telling the user about our mistake. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
